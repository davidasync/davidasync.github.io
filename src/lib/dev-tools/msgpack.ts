/**
 * Base64 MessagePack to JSON and back, in the browser.
 *
 * Plain MessagePack maps onto JSON almost one to one. What a generic decoder
 * leaves unreadable is what Go services put inside it: timestamps travel as
 * extension -1, and `bin` values often hold a Go gob stream — mo.Option, for
 * one, writes a present flag and then gob-encodes the value. Both are unpacked
 * here, so a token minted by a Go service reads as plain JSON.
 *
 * Packing has to put those encodings back, or the service that minted a token
 * cannot read the edited one, and JSON has no room to carry them. So unpacking
 * also notes how each value was encoded — the token's shape — and packing
 * against that token follows it: an unchanged value goes back byte for byte, a
 * changed one in the encoding it had, and a new one as plain MessagePack.
 */

type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

type JsonObject = { [key: string]: Json };

/** Object keys and array indexes from the root down to a value. */
type Path = Array<string | number>;

const TIMESTAMP_EXT = -1;

// BigInt() rather than 0n-style literals: those need an ES2020 target, and
// this project compiles to ES2017.
const BIG_ZERO = BigInt(0);
const BIG_ONE = BigInt(1);
const BYTE_BITS = BigInt(8);
const BYTE_MASK = BigInt(0xff);
const U64_MAX = (BIG_ONE << BigInt(64)) - BIG_ONE;
const I64_MIN = -(BIG_ONE << BigInt(63));
const I64_MAX = (BIG_ONE << BigInt(63)) - BIG_ONE;

/** Seconds between Go's zero time, January 1 of year 1, and the Unix epoch. */
const GO_UNIX_OFFSET = BigInt(62135596800);

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);

type GobType =
  | { kind: "array"; name: string; elem: number; length: number }
  | { kind: "slice"; name: string; elem: number }
  | { kind: "struct"; name: string; fields: Array<{ name: string; id: number }> }
  | { kind: "map"; name: string; key: number; elem: number }
  | { kind: "external"; name: string };

/** What it takes to write a new value into a gob stream like the one read. */
type GobTemplate = {
  /** mo.Option's leading present byte. */
  optionFlag: boolean;
  /** The stream's type-definition messages, replayed ahead of the new value. */
  definitions: Uint8Array;
  typeId: number;
  types: Map<number, GobType>;
};

type WireKind =
  | "timestamp"
  | "ext"
  | "bin"
  | "bin-text"
  | "option-none"
  | "gob"
  | "gob-values"
  | "uint64"
  | "int64"
  | "float32"
  | "float64"
  | "keyed-map";

type Wire = {
  kind: WireKind;
  /** The value exactly as it was encoded, reused while it is unchanged. */
  raw: Uint8Array;
  /** The value as JSON, to tell whether it has been edited. */
  json: string;
  gob?: GobTemplate;
};

/**
 * How each value that plain MessagePack would not reproduce was encoded. Keyed
 * by its exact path, and by the same path with array indexes wildcarded, so an
 * element added to a list is packed like the ones already in it.
 */
export type MsgpackShape = Map<string, Wire>;

export type UnpackedMsgpack = {
  json: string;
  shape: MsgpackShape;
  size: number;
};

export type PackedMsgpack = {
  base64: string;
  size: number;
};

export function unpackMsgpack(input: string): UnpackedMsgpack {
  const bytes = parseBase64(input);
  const shape: MsgpackShape = new Map();
  const reader = new MsgpackReader(bytes, shape);
  const value = reader.read([]);

  if (reader.offset !== bytes.length) {
    throw new Error(
      `${bytes.length - reader.offset} trailing bytes after the MessagePack value.`,
    );
  }

  return { json: JSON.stringify(value, null, 2), shape, size: bytes.length };
}

/**
 * Packs JSON as MessagePack. With `template` — the Base64 token the JSON was
 * unpacked from — values keep the encodings they had in it.
 */
export function packMsgpack(jsonText: string, template = ""): PackedMsgpack {
  let value: Json;

  try {
    value = JSON.parse(jsonText) as Json;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    throw new Error(`Invalid JSON: ${message}`);
  }

  const shape: MsgpackShape =
    template.trim() === "" ? new Map() : unpackMsgpack(template).shape;
  const out = new ByteWriter();
  new MsgpackPacker(out, shape).pack(value, []);
  const bytes = out.result();

  return { base64: encodeBase64(bytes), size: bytes.length };
}

/**
 * Standard or URL-safe Base64, padded or not — and percent-encoded, or wrapped
 * in quotes, for a value copied out of a query string or a JSON body.
 */
function parseBase64(input: string) {
  let compact = input.trim().replace(/^"|"$/g, "");

  if (compact.includes("%")) {
    try {
      compact = decodeURIComponent(compact);
    } catch {
      // Not percent-encoded after all; validated below.
    }
  }

  compact = compact.replace(/\s/g, "");

  if (compact === "") {
    throw new Error("Paste a Base64 MessagePack value to unpack.");
  }

  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(compact)) {
    throw new Error("Input is not valid Base64.");
  }

  return decodeBase64(compact, "Input is not valid Base64.");
}

class MsgpackReader {
  offset = 0;
  private readonly bytes: Uint8Array;
  private readonly view: DataView;
  private readonly shape: MsgpackShape;

  constructor(bytes: Uint8Array, shape: MsgpackShape) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.shape = shape;
  }

  read(path: Path): Json {
    const start = this.offset;
    const type = this.uint8();

    if (type <= 0x7f) return type;
    if (type >= 0xe0) return type - 0x100;
    if (type <= 0x8f) return this.map(type & 0x0f, path, start);
    if (type <= 0x9f) return this.array(type & 0x0f, path);
    if (type <= 0xbf) return this.string(type & 0x1f);

    switch (type) {
      case 0xc0:
        return null;
      case 0xc2:
        return false;
      case 0xc3:
        return true;
      case 0xc4:
        return this.bin(this.uint8(), path, start);
      case 0xc5:
        return this.bin(this.uint16(), path, start);
      case 0xc6:
        return this.bin(this.uint32(), path, start);
      case 0xc7:
        return this.ext(this.uint8(), path, start);
      case 0xc8:
        return this.ext(this.uint16(), path, start);
      case 0xc9:
        return this.ext(this.uint32(), path, start);
      case 0xca:
        return this.note(
          path,
          start,
          "float32",
          this.number(4, (offset) => this.view.getFloat32(offset)),
        );
      case 0xcb:
        return this.note(
          path,
          start,
          "float64",
          this.number(8, (offset) => this.view.getFloat64(offset)),
        );
      case 0xcc:
        return this.uint8();
      case 0xcd:
        return this.uint16();
      case 0xce:
        return this.uint32();
      case 0xcf:
        return this.note(path, start, "uint64", bigintToJson(this.bigint(false)));
      case 0xd0:
        return this.number(1, (offset) => this.view.getInt8(offset));
      case 0xd1:
        return this.number(2, (offset) => this.view.getInt16(offset));
      case 0xd2:
        return this.number(4, (offset) => this.view.getInt32(offset));
      case 0xd3:
        return this.note(path, start, "int64", bigintToJson(this.bigint(true)));
      case 0xd4:
        return this.ext(1, path, start);
      case 0xd5:
        return this.ext(2, path, start);
      case 0xd6:
        return this.ext(4, path, start);
      case 0xd7:
        return this.ext(8, path, start);
      case 0xd8:
        return this.ext(16, path, start);
      case 0xd9:
        return this.string(this.uint8());
      case 0xda:
        return this.string(this.uint16());
      case 0xdb:
        return this.string(this.uint32());
      case 0xdc:
        return this.array(this.uint16(), path);
      case 0xdd:
        return this.array(this.uint32(), path);
      case 0xde:
        return this.map(this.uint16(), path, start);
      case 0xdf:
        return this.map(this.uint32(), path, start);
      default:
        throw new Error(
          `Unknown MessagePack type 0x${type.toString(16)} at byte ${start}.`,
        );
    }
  }

  /** Records how the value just read was encoded, and passes it through. */
  private note(
    path: Path,
    start: number,
    kind: WireKind,
    value: Json,
    gob?: GobTemplate,
  ) {
    const wire: Wire = {
      kind,
      raw: this.bytes.slice(start, this.offset),
      json: JSON.stringify(value),
      gob,
    };
    const wildcard = wildcardKey(path);

    this.shape.set(pathKey(path), wire);
    if (!this.shape.has(wildcard)) this.shape.set(wildcard, wire);

    return value;
  }

  private map(size: number, path: Path, start: number): Json {
    const entries: Array<[string, Json]> = [];
    let keyed = false;

    for (let index = 0; index < size; index += 1) {
      const key = this.read([...path, "\0key"]);
      const name = jsonKey(key);
      keyed ||= typeof key !== "string";
      entries.push([name, this.read([...path, name])]);
    }

    // fromEntries defines own properties, so a "__proto__" key stays a key.
    const value = Object.fromEntries(entries);
    return keyed ? this.note(path, start, "keyed-map", value) : value;
  }

  private array(size: number, path: Path): Json {
    const items: Json[] = [];

    for (let index = 0; index < size; index += 1) {
      items.push(this.read([...path, index]));
    }

    return items;
  }

  private string(length: number) {
    return new TextDecoder().decode(this.take(length));
  }

  private bin(length: number, path: Path, start: number) {
    const decoded = decodeBin(this.take(length));
    return this.note(path, start, decoded.kind, decoded.value, decoded.gob);
  }

  private ext(length: number, path: Path, start: number): Json {
    const type = this.number(1, (offset) => this.view.getInt8(offset));
    const data = this.take(length);

    if (type === TIMESTAMP_EXT) {
      const timestamp = decodeTimestamp(data);
      if (timestamp !== null) {
        return this.note(path, start, "timestamp", timestamp);
      }
    }

    return this.note(path, start, "ext", {
      $ext: type,
      $base64: encodeBase64(data),
    });
  }

  private uint8() {
    return this.number(1, (offset) => this.view.getUint8(offset));
  }

  private uint16() {
    return this.number(2, (offset) => this.view.getUint16(offset));
  }

  private uint32() {
    return this.number(4, (offset) => this.view.getUint32(offset));
  }

  private bigint(signed: boolean) {
    return this.number(8, (offset) =>
      signed ? this.view.getBigInt64(offset) : this.view.getBigUint64(offset),
    );
  }

  private number<T>(size: number, read: (offset: number) => T) {
    this.ensure(size);
    const value = read(this.offset);
    this.offset += size;
    return value;
  }

  private take(length: number) {
    this.ensure(length);
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  private ensure(length: number) {
    if (this.offset + length > this.bytes.length) {
      throw new Error(
        `MessagePack ended early: needed ${length} more bytes at byte ${this.offset}.`,
      );
    }
  }
}

class MsgpackPacker {
  private readonly out: ByteWriter;
  private readonly shape: MsgpackShape;

  constructor(out: ByteWriter, shape: MsgpackShape) {
    this.out = out;
    this.shape = shape;
  }

  pack(value: Json, path: Path) {
    const wire =
      this.shape.get(pathKey(path)) ?? this.shape.get(wildcardKey(path));

    if (wire?.json === JSON.stringify(value)) {
      this.out.bytes(wire.raw);
      return;
    }

    if (wire && this.packAs(wire, value, path)) return;
    this.packPlain(value, path);
  }

  /**
   * A changed value, written in the encoding the template had for it. False
   * when the value no longer fits that encoding, and plain packing takes it.
   */
  private packAs(wire: Wire, value: Json, path: Path) {
    switch (wire.kind) {
      case "timestamp":
        if (typeof value !== "string") return false;
        writeTimestamp(this.out, parseTime(value, path));
        return true;
      case "bin-text":
        if (typeof value !== "string") return false;
        writeBin(this.out, textBytes(value));
        return true;
      case "option-none":
        writeBin(this.out, packOption(value, null, path));
        return true;
      case "gob":
        if (!wire.gob) return false;
        if (wire.gob.optionFlag) {
          writeBin(this.out, packOption(value, wire.gob, path));
          return true;
        }
        if (value === null) return false;
        writeBin(this.out, packGob(value, wire.gob, path));
        return true;
      case "gob-values":
        throw new Error(
          `${formatPath(path)} holds several gob values, so it cannot be packed once edited.`,
        );
      case "uint64":
      case "int64":
        if (typeof value === "number" && Number.isInteger(value)) {
          writeInt(this.out, BigInt(value), path);
          return true;
        }
        if (typeof value === "string" && /^-?\d+$/.test(value)) {
          writeInt(this.out, BigInt(value), path);
          return true;
        }
        return false;
      case "float32":
        if (typeof value !== "number") return false;
        this.out.byte(0xca);
        this.out.float32(value);
        return true;
      case "float64":
        if (typeof value !== "number") return false;
        this.out.byte(0xcb);
        this.out.float64(value);
        return true;
      case "keyed-map":
        if (!isObject(value)) return false;
        this.packMap(value, path, true);
        return true;
      case "ext":
      case "bin":
        // Self-describing: {"$base64"} and {"$ext"} pack back as they read.
        return false;
    }
  }

  private packPlain(value: Json, path: Path) {
    if (value === null) {
      this.out.byte(0xc0);
    } else if (typeof value === "boolean") {
      this.out.byte(value ? 0xc3 : 0xc2);
    } else if (typeof value === "number") {
      if (Number.isSafeInteger(value)) {
        writeInt(this.out, BigInt(value), path);
      } else {
        this.out.byte(0xcb);
        this.out.float64(value);
      }
    } else if (typeof value === "string") {
      writeString(this.out, value);
    } else if (Array.isArray(value)) {
      writeHeader(this.out, value.length, 0x90, 0xdc, 0xdd);
      value.forEach((item, index) => this.pack(item, [...path, index]));
    } else if (isRawBytes(value)) {
      writeBin(this.out, decodeBase64Field(value.$base64, path));
    } else if (isRawExt(value)) {
      writeExt(this.out, value.$ext, decodeBase64Field(value.$base64, path));
    } else {
      this.packMap(value, path, false);
    }
  }

  /**
   * Keys that were not strings were written into JSON as their JSON, so a
   * keyed map parses them back: "7" becomes the integer it was.
   */
  private packMap(value: JsonObject, path: Path, keyed: boolean) {
    const entries = Object.entries(value);
    writeHeader(this.out, entries.length, 0x80, 0xde, 0xdf);

    for (const [key, item] of entries) {
      if (keyed) {
        this.packPlain(parseKey(key), [...path, "\0key"]);
      } else {
        writeString(this.out, key);
      }
      this.pack(item, [...path, key]);
    }
  }
}

function parseKey(key: string): Json {
  try {
    const parsed = JSON.parse(key) as Json;
    if (typeof parsed !== "string") return parsed;
  } catch {
    // A plain string key.
  }
  return key;
}

function pathKey(path: Path) {
  return JSON.stringify(path);
}

/** null, rather than a string, so it cannot collide with a key named "*". */
function wildcardKey(path: Path) {
  return JSON.stringify(path.map((part) => (typeof part === "number" ? null : part)));
}

function formatPath(path: Path) {
  return `$${path
    .map((part) =>
      typeof part === "number"
        ? `[${part}]`
        : /^[A-Za-z_$][\w$]*$/.test(part)
          ? `.${part}`
          : `[${JSON.stringify(part)}]`,
    )
    .join("")}`;
}

/** The 32-, 64- and 96-bit layouts of the MessagePack timestamp extension. */
function decodeTimestamp(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  if (data.length === 4) {
    return formatTime(BigInt(view.getUint32(0)), 0);
  }

  if (data.length === 8) {
    const packed = view.getBigUint64(0);
    // 30 bits of nanoseconds above 34 bits of seconds.
    return formatTime(packed & BigInt(0x3ffffffff), Number(packed >> BigInt(34)));
  }

  if (data.length === 12) {
    return formatTime(view.getBigInt64(4), view.getUint32(0));
  }

  return null;
}

/** The smallest layout that holds the time, chosen the way Go's msgpack does. */
function writeTimestamp(out: ByteWriter, { seconds, nanos }: Time) {
  if (seconds >= BIG_ZERO && seconds >> BigInt(34) === BIG_ZERO) {
    const packed = (BigInt(nanos) << BigInt(34)) | seconds;

    if (packed >> BigInt(32) === BIG_ZERO) {
      out.byte(0xd6);
      out.byte(0xff);
      out.uint(4, packed);
    } else {
      out.byte(0xd7);
      out.byte(0xff);
      out.uint(8, packed);
    }
    return;
  }

  out.byte(0xc7);
  out.byte(12);
  out.byte(0xff);
  out.uint(4, BigInt(nanos));
  out.uint(8, BigInt.asUintN(64, seconds));
}

type Time = { seconds: bigint; nanos: number };

/** RFC 3339 in UTC with as many fraction digits as it needs, like Go prints. */
function formatTime(seconds: bigint, nanos: number) {
  const date = new Date(Number(seconds) * 1000);
  if (Number.isNaN(date.getTime()) || nanos > 999_999_999) return null;

  const fraction = nanos
    ? `.${String(nanos).padStart(9, "0").replace(/0+$/, "")}`
    : "";

  return `${date.toISOString().slice(0, 19)}${fraction}Z`;
}

/** RFC 3339 with up to nanosecond precision and any offset. */
function parseTime(text: string, path: Path): Time {
  const match = text
    .trim()
    .match(
      /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?([Zz]|[+-]\d{2}:\d{2})$/,
    );

  if (match) {
    const [, year, month, day, hour, minute, second, fraction = "", zone] =
      match;
    const date = new Date(0);
    date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
    date.setUTCHours(Number(hour), Number(minute), Number(second), 0);

    const valid =
      date.getUTCMonth() === Number(month) - 1 &&
      date.getUTCDate() === Number(day) &&
      date.getUTCHours() === Number(hour) &&
      date.getUTCMinutes() === Number(minute);

    if (valid) {
      const offset =
        zone.toUpperCase() === "Z"
          ? 0
          : (zone[0] === "-" ? -1 : 1) *
            (Number(zone.slice(1, 3)) * 3600 + Number(zone.slice(4, 6)) * 60);

      return {
        seconds: BigInt(date.getTime() / 1000 - offset),
        nanos: Number(fraction.padEnd(9, "0")),
      };
    }
  }

  throw new Error(
    `${formatPath(path)} must be an RFC 3339 time, like 2026-10-08T08:04:30Z.`,
  );
}

type DecodedBin = { value: Json; kind: WireKind; gob?: GobTemplate };

/**
 * Bytes that are readable text — a decimal, a date — come out as a string. A
 * leading 0 or 1 followed by gob is how mo.Option writes itself: absent, or
 * present and then the value. Anything else is left as Base64.
 */
function decodeBin(data: Uint8Array): DecodedBin {
  if (data.length === 0) return { value: "", kind: "bin-text" };

  const text = readableText(data);
  if (text !== null) return { value: text, kind: "bin-text" };

  if (data.length === 1 && data[0] === 0) {
    return { value: null, kind: "option-none" };
  }

  if (data[0] === 1) {
    const option = tryGob(data.subarray(1), true);
    if (option) return option;
  }

  return (
    tryGob(data, false) ?? {
      value: { $base64: encodeBase64(data) },
      kind: "bin",
    }
  );
}

function tryGob(data: Uint8Array, optionFlag: boolean): DecodedBin | null {
  try {
    const { value, template } = new GobReader(data).stream();

    return template
      ? { value, kind: "gob", gob: { ...template, optionFlag } }
      : { value, kind: "gob-values" };
  } catch {
    return null;
  }
}

/** Type ids gob reserves for its built-in types. */
const GOB = {
  bool: 1,
  int: 2,
  uint: 3,
  float: 4,
  bytes: 5,
  string: 6,
  complex: 7,
  interface: 8,
} as const;

/**
 * A Go gob stream: length-prefixed messages, each either a type definition
 * (negative id) or a value of a type defined earlier. Self-describing, so the
 * field names come from the stream itself.
 */
class GobReader {
  private offset = 0;
  private readonly bytes: Uint8Array;
  private readonly types = new Map<number, GobType>();

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  stream(): { value: Json; template: Omit<GobTemplate, "optionFlag"> | null } {
    const values: Json[] = [];
    const definitions = new ByteWriter();
    let typeId = 0;

    while (this.offset < this.bytes.length) {
      const start = this.offset;
      // Read the length before taking the offset: it starts after the prefix.
      const length = this.count();
      const end = this.offset + length;
      if (end > this.bytes.length) throw new Error("gob message overruns input.");

      const id = this.int();

      if (id < 0) {
        this.types.set(-id, this.wireType());
        definitions.bytes(this.bytes.subarray(start, end));
      } else {
        typeId = id;
        values.push(this.topLevel(id));
      }

      if (this.offset !== end) throw new Error("gob message length mismatch.");
    }

    if (values.length === 0) throw new Error("gob stream has no value.");
    if (values.length > 1) return { value: values, template: null };

    return {
      value: values[0],
      template: { definitions: definitions.result(), typeId, types: this.types },
    };
  }

  /** Structs are sent bare; any other top-level value after a zero field delta. */
  private topLevel(id: number): Json {
    if (this.types.get(id)?.kind === "struct") return this.value(id);
    if (this.count() !== 0) throw new Error("gob singleton is missing its marker.");
    return this.value(id);
  }

  private value(id: number): Json {
    switch (id) {
      case GOB.bool:
        return this.uint() !== BIG_ZERO;
      case GOB.int:
        return bigintToJson(this.signed());
      case GOB.uint:
        return bigintToJson(this.uint());
      case GOB.float:
        return this.float();
      case GOB.bytes: {
        const data = this.take(this.count());
        return readableText(data) ?? { $base64: encodeBase64(data) };
      }
      case GOB.string:
        return new TextDecoder().decode(this.take(this.count()));
      case GOB.complex:
        return [this.float(), this.float()];
      case GOB.interface:
        return this.interfaceValue();
    }

    const type = this.types.get(id);
    if (!type) throw new Error(`gob type ${id} is not defined.`);

    switch (type.kind) {
      case "array":
      case "slice": {
        const size = this.count();
        const items: Json[] = [];
        for (let index = 0; index < size; index += 1) {
          items.push(this.value(type.elem));
        }
        return items;
      }
      case "map": {
        const size = this.count();
        const entries: Array<[string, Json]> = [];
        for (let index = 0; index < size; index += 1) {
          const key = this.value(type.key);
          entries.push([jsonKey(key), this.value(type.elem)]);
        }
        return Object.fromEntries(entries);
      }
      case "struct":
        return this.struct(type);
      case "external":
        return externalValue(type.name, this.take(this.count()));
    }
  }

  /**
   * Gob leaves zero-valued fields out. They are put back, so a false or a 0
   * still shows instead of the field going missing.
   */
  private struct(type: Extract<GobType, { kind: "struct" }>): Json {
    const values = new Map<number, Json>();

    this.fields((field) => {
      const definition = type.fields[field];
      if (!definition) throw new Error("gob struct field out of range.");
      values.set(field, this.value(definition.id));
    });

    return Object.fromEntries(
      type.fields.map((field, index) => [
        field.name,
        values.has(index) ? (values.get(index) as Json) : this.zero(field.id, 0),
      ]),
    );
  }

  private zero(id: number, depth: number): Json {
    switch (id) {
      case GOB.bool:
        return false;
      case GOB.int:
      case GOB.uint:
      case GOB.float:
        return 0;
      case GOB.string:
      case GOB.bytes:
        return "";
      case GOB.complex:
        return [0, 0];
    }

    const type = this.types.get(id);
    if (type?.kind !== "struct" || depth > 8) return null;

    return Object.fromEntries(
      type.fields.map((field) => [field.name, this.zero(field.id, depth + 1)]),
    );
  }

  private interfaceValue(): Json {
    const name = this.text();
    if (name === "") return null;

    const id = this.int();
    const length = this.count();
    const end = this.offset + length;
    const value = this.topLevel(id);

    if (this.offset !== end) throw new Error("gob interface length mismatch.");
    return value;
  }

  /** A wireType struct sets exactly one of its fields: the kind being defined. */
  private wireType(): GobType {
    const field = this.count() - 1;
    let type: GobType;

    switch (field) {
      case 0: {
        let name = "";
        let elem = 0;
        let length = 0;
        this.fields((inner) => {
          if (inner === 0) name = this.commonType();
          else if (inner === 1) elem = this.int();
          else if (inner === 2) length = this.int();
          else throw new Error("unexpected gob arrayType field.");
        });
        type = { kind: "array", name, elem, length };
        break;
      }
      case 1: {
        let name = "";
        let elem = 0;
        this.fields((inner) => {
          if (inner === 0) name = this.commonType();
          else if (inner === 1) elem = this.int();
          else throw new Error("unexpected gob sliceType field.");
        });
        type = { kind: "slice", name, elem };
        break;
      }
      case 2: {
        let name = "";
        const fields: Array<{ name: string; id: number }> = [];
        this.fields((inner) => {
          if (inner === 0) {
            name = this.commonType();
          } else if (inner === 1) {
            const size = this.count();
            for (let index = 0; index < size; index += 1) {
              const entry = { name: "", id: 0 };
              this.fields((part) => {
                if (part === 0) entry.name = this.text();
                else if (part === 1) entry.id = this.int();
                else throw new Error("unexpected gob fieldType field.");
              });
              fields.push(entry);
            }
          } else {
            throw new Error("unexpected gob structType field.");
          }
        });
        type = { kind: "struct", name, fields };
        break;
      }
      case 3: {
        let name = "";
        let key = 0;
        let elem = 0;
        this.fields((inner) => {
          if (inner === 0) name = this.commonType();
          else if (inner === 1) key = this.int();
          else if (inner === 2) elem = this.int();
          else throw new Error("unexpected gob mapType field.");
        });
        type = { kind: "map", name, key, elem };
        break;
      }
      case 4:
      case 5:
      case 6: {
        let name = "";
        this.fields((inner) => {
          if (inner === 0) name = this.commonType();
          else throw new Error("unexpected gob encoder type field.");
        });
        type = { kind: "external", name };
        break;
      }
      default:
        throw new Error("unknown gob wire type.");
    }

    if (this.count() !== 0) throw new Error("gob wireType sets more than one kind.");
    return type;
  }

  /** CommonType{Name, Id}. Only the name is needed; the id is the message's. */
  private commonType() {
    let name = "";
    this.fields((field) => {
      if (field === 0) name = this.text();
      else if (field === 1) this.int();
      else throw new Error("unexpected gob CommonType field.");
    });
    return name;
  }

  /** Walks a struct's field deltas until the terminating zero. */
  private fields(read: (field: number) => void) {
    let field = -1;

    for (;;) {
      const delta = this.count();
      if (delta === 0) return;
      field += delta;
      read(field);
    }
  }

  private text() {
    return new TextDecoder().decode(this.take(this.count()));
  }

  /** Small enough to be a length, a count or a type id. */
  private count() {
    const value = this.uint();
    if (value > BigInt(this.bytes.length)) {
      throw new Error("gob count exceeds input.");
    }
    return Number(value);
  }

  private int() {
    const value = this.signed();
    if (value > MAX_SAFE || value < MIN_SAFE) {
      throw new Error("gob id out of range.");
    }
    return Number(value);
  }

  /** One byte below 128; otherwise the negated byte count, then big-endian bytes. */
  private uint() {
    const first = this.byte();
    if (first < 0x80) return BigInt(first);

    const size = 0x100 - first;
    if (size > 8) throw new Error("gob integer is too long.");

    let value = BIG_ZERO;
    for (let index = 0; index < size; index += 1) {
      value = (value << BYTE_BITS) | BigInt(this.byte());
    }
    return value;
  }

  /** Zig-zag: the low bit is the sign, complemented. */
  private signed() {
    const value = this.uint();
    return value & BIG_ONE ? ~(value >> BIG_ONE) : value >> BIG_ONE;
  }

  /** The float64 bits, sent byte-reversed so small exponents stay short. */
  private float() {
    const view = new DataView(new ArrayBuffer(8));
    view.setBigUint64(0, reverseBytes(this.uint()));
    return view.getFloat64(0);
  }

  private byte() {
    if (this.offset >= this.bytes.length) throw new Error("gob ended early.");
    return this.bytes[this.offset++];
  }

  private take(length: number) {
    if (this.offset + length > this.bytes.length) {
      throw new Error("gob ended early.");
    }
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }
}

/**
 * An mo.Option: a lone 0 when absent, otherwise 1 and a gob stream. One that
 * was absent in the template carries no gob types, so filling it in only works
 * for the values gob has built-in types for.
 */
function packOption(value: Json, template: GobTemplate | null, path: Path) {
  if (value === null) return Uint8Array.of(0);

  const out = new ByteWriter();
  out.byte(1);

  if (template) {
    out.bytes(template.definitions);
    writeGobMessage(out, template.typeId, template.types, value, path);
  } else {
    writeGobMessage(out, builtinGobType(value, path), new Map(), value, path);
  }

  return out.result();
}

function packGob(value: Json, template: GobTemplate, path: Path) {
  const out = new ByteWriter();
  out.bytes(template.definitions);
  writeGobMessage(out, template.typeId, template.types, value, path);
  return out.result();
}

function builtinGobType(value: Json, path: Path) {
  if (typeof value === "string") return GOB.string;
  if (typeof value === "boolean") return GOB.bool;
  if (typeof value === "number") {
    return Number.isInteger(value) ? GOB.int : GOB.float;
  }

  throw new Error(
    `${formatPath(path)} was empty in the unpacked token, so its type is unknown. Only a string, number or boolean can be filled in.`,
  );
}

/** One value message: its type id, the singleton marker if not a struct, the value. */
function writeGobMessage(
  out: ByteWriter,
  id: number,
  types: Map<number, GobType>,
  value: Json,
  path: Path,
) {
  const body = new ByteWriter();
  writeGobInt(body, BigInt(id));
  if (types.get(id)?.kind !== "struct") writeGobUint(body, BIG_ZERO);
  new GobPacker(body, types).value(value, id, path);

  const bytes = body.result();
  writeGobUint(out, BigInt(bytes.length));
  out.bytes(bytes);
}

class GobPacker {
  private readonly out: ByteWriter;
  private readonly types: Map<number, GobType>;

  constructor(out: ByteWriter, types: Map<number, GobType>) {
    this.out = out;
    this.types = types;
  }

  value(value: Json, id: number, path: Path): void {
    switch (id) {
      case GOB.bool:
        if (typeof value !== "boolean") throw expected(path, "a boolean");
        writeGobUint(this.out, value ? BIG_ONE : BIG_ZERO);
        return;
      case GOB.int:
        writeGobInt(this.out, integer(value, path, true));
        return;
      case GOB.uint:
        writeGobUint(this.out, integer(value, path, false));
        return;
      case GOB.float:
        if (typeof value !== "number") throw expected(path, "a number");
        writeGobFloat(this.out, value);
        return;
      case GOB.bytes:
        writeGobBytes(this.out, bytesOf(value, path));
        return;
      case GOB.string:
        if (typeof value !== "string") throw expected(path, "a string");
        writeGobBytes(this.out, textBytes(value));
        return;
      case GOB.complex:
        if (
          !Array.isArray(value) ||
          value.length !== 2 ||
          typeof value[0] !== "number" ||
          typeof value[1] !== "number"
        ) {
          throw expected(path, "a [real, imaginary] pair");
        }
        writeGobFloat(this.out, value[0]);
        writeGobFloat(this.out, value[1]);
        return;
      case GOB.interface:
        if (value !== null) {
          throw new Error(
            `${formatPath(path)} is a Go interface value; only null can be packed into it.`,
          );
        }
        writeGobUint(this.out, BIG_ZERO);
        return;
    }

    const type = this.types.get(id);
    if (!type) throw new Error(`${formatPath(path)} has an undefined gob type.`);

    switch (type.kind) {
      case "array":
      case "slice": {
        if (!Array.isArray(value)) throw expected(path, "an array");
        if (type.kind === "array" && value.length !== type.length) {
          throw expected(path, `an array of ${type.length}`);
        }
        writeGobUint(this.out, BigInt(value.length));
        value.forEach((item, index) =>
          this.value(item, type.elem, [...path, index]),
        );
        return;
      }
      case "map": {
        if (!isObject(value)) throw expected(path, "an object");
        const entries = Object.entries(value);
        writeGobUint(this.out, BigInt(entries.length));
        for (const [key, item] of entries) {
          this.key(key, type.key, [...path, key]);
          this.value(item, type.elem, [...path, key]);
        }
        return;
      }
      case "struct": {
        if (!isObject(value)) throw expected(path, "an object");
        const names = new Set(type.fields.map((field) => field.name));
        const unknown = Object.keys(value).find((key) => !names.has(key));
        if (unknown !== undefined) {
          throw new Error(
            `${formatPath([...path, unknown])} is not a field of ${type.name || "this struct"}.`,
          );
        }

        let previous = -1;
        type.fields.forEach((field, index) => {
          const item = Object.prototype.hasOwnProperty.call(value, field.name)
            ? value[field.name]
            : null;
          if (this.isZero(item, field.id)) return;

          writeGobUint(this.out, BigInt(index - previous));
          previous = index;
          this.value(item, field.id, [...path, field.name]);
        });
        writeGobUint(this.out, BIG_ZERO);
        return;
      }
      case "external":
        writeGobBytes(this.out, externalBytes(type.name, value, path));
        return;
    }
  }

  /**
   * Map keys arrive as JSON object keys, so they are strings whatever they
   * were. Integers are read with BigInt so 64-bit keys keep every digit.
   */
  private key(key: string, id: number, path: Path) {
    if (id === GOB.string) {
      this.value(key, id, path);
    } else if (id === GOB.int || id === GOB.uint) {
      this.value(/^-?\d+$/.test(key) ? key : parseKey(key), id, path);
    } else {
      this.value(parseKey(key), id, path);
    }
  }

  /**
   * Gob leaves zero values out of a struct, and so does this. Nested structs
   * are always sent, as Go does.
   */
  private isZero(value: Json, id: number) {
    if (value === null || value === false || value === 0 || value === "") {
      return true;
    }

    const kind = this.types.get(id)?.kind;
    if (Array.isArray(value)) return value.length === 0 && kind === "slice";
    if (isObject(value)) return Object.keys(value).length === 0 && kind === "map";
    return false;
  }
}

function integer(value: Json, path: Path, signed: boolean) {
  let result: bigint | null = null;

  if (typeof value === "number" && Number.isInteger(value)) {
    result = BigInt(value);
  } else if (typeof value === "string" && /^-?\d+$/.test(value)) {
    result = BigInt(value);
  }

  if (result === null) throw expected(path, "an integer");
  if (signed ? result < I64_MIN || result > I64_MAX : result < BIG_ZERO || result > U64_MAX) {
    throw expected(path, signed ? "a 64-bit integer" : "an unsigned 64-bit integer");
  }

  return result;
}

function expected(path: Path, what: string) {
  return new Error(`${formatPath(path)} must be ${what}.`);
}

function bytesOf(value: Json, path: Path) {
  if (typeof value === "string") return textBytes(value);
  if (isRawBytes(value)) return decodeBase64Field(value.$base64, path);
  throw expected(path, 'a string, or {"$base64": "…"} for raw bytes');
}

/**
 * A GobEncoder, BinaryMarshaler or TextMarshaler value. time.Time is common
 * enough to read; text comes out as text; anything else stays Base64.
 */
function externalValue(name: string, data: Uint8Array): Json {
  if (isTimeType(name)) {
    const time = decodeGoTime(data);
    if (time !== null) return time;
  }

  return readableText(data) ?? { $base64: encodeBase64(data) };
}

function externalBytes(name: string, value: Json, path: Path) {
  if (isTimeType(name) && typeof value === "string") {
    return encodeGoTime(parseTime(value, path));
  }

  return bytesOf(value, path);
}

function isTimeType(name: string) {
  return /(^|\.)Time$/.test(name);
}

/** time.Time.MarshalBinary: version, seconds since year 1, nanos, zone offset. */
function decodeGoTime(data: Uint8Array) {
  if (!((data[0] === 1 && data.length === 15) || (data[0] === 2 && data.length === 16))) {
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return formatTime(view.getBigInt64(1) - GO_UNIX_OFFSET, view.getInt32(9));
}

/** Version 1 with offset -1, which is how Go marks a time as UTC. */
function encodeGoTime({ seconds, nanos }: Time) {
  const out = new ByteWriter();
  out.byte(1);
  out.uint(8, BigInt.asUintN(64, seconds + GO_UNIX_OFFSET));
  out.uint(4, BigInt(nanos));
  out.uint(2, BigInt(0xffff));
  return out.result();
}

function writeGobUint(out: ByteWriter, value: bigint) {
  if (value < BigInt(0x80)) {
    out.byte(Number(value));
    return;
  }

  let size = 0;
  for (let rest = value; rest > BIG_ZERO; rest >>= BYTE_BITS) size += 1;

  out.byte(0x100 - size);
  out.uint(size, value);
}

function writeGobInt(out: ByteWriter, value: bigint) {
  writeGobUint(
    out,
    value < BIG_ZERO ? (~value << BIG_ONE) | BIG_ONE : value << BIG_ONE,
  );
}

function writeGobFloat(out: ByteWriter, value: number) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  writeGobUint(out, reverseBytes(view.getBigUint64(0)));
}

function writeGobBytes(out: ByteWriter, data: Uint8Array) {
  writeGobUint(out, BigInt(data.length));
  out.bytes(data);
}

function reverseBytes(value: bigint) {
  let rest = value;
  let reversed = BIG_ZERO;

  for (let index = 0; index < 8; index += 1) {
    reversed = (reversed << BYTE_BITS) | (rest & BYTE_MASK);
    rest >>= BYTE_BITS;
  }

  return reversed;
}

/** The most compact integer encoding, as Go's msgpack writes it. */
function writeInt(out: ByteWriter, value: bigint, path: Path) {
  if (value >= BIG_ZERO) {
    if (value <= BigInt(0x7f)) {
      out.byte(Number(value));
    } else if (value <= BigInt(0xff)) {
      out.byte(0xcc);
      out.uint(1, value);
    } else if (value <= BigInt(0xffff)) {
      out.byte(0xcd);
      out.uint(2, value);
    } else if (value <= BigInt(0xffffffff)) {
      out.byte(0xce);
      out.uint(4, value);
    } else if (value <= U64_MAX) {
      out.byte(0xcf);
      out.uint(8, value);
    } else {
      throw expected(path, "at most 64 bits");
    }
    return;
  }

  if (value >= BigInt(-32)) {
    out.byte(0x100 + Number(value));
    return;
  }

  const sizes: Array<[number, number]> = [
    [0xd0, 1],
    [0xd1, 2],
    [0xd2, 4],
    [0xd3, 8],
  ];

  for (const [type, size] of sizes) {
    if (value >= -(BIG_ONE << BigInt(size * 8 - 1))) {
      out.byte(type);
      out.uint(size, BigInt.asUintN(size * 8, value));
      return;
    }
  }

  throw expected(path, "at most 64 bits");
}

function writeString(out: ByteWriter, value: string) {
  const data = textBytes(value);
  if (data.length < 32) {
    out.byte(0xa0 | data.length);
  } else {
    writeLength(out, data.length, 0xd9, 0xda, 0xdb);
  }
  out.bytes(data);
}

function writeBin(out: ByteWriter, data: Uint8Array) {
  writeLength(out, data.length, 0xc4, 0xc5, 0xc6);
  out.bytes(data);
}

function writeExt(out: ByteWriter, type: number, data: Uint8Array) {
  const fixed = [1, 2, 4, 8, 16].indexOf(data.length);

  if (fixed >= 0) {
    out.byte(0xd4 + fixed);
  } else {
    writeLength(out, data.length, 0xc7, 0xc8, 0xc9);
  }

  out.byte(type & 0xff);
  out.bytes(data);
}

function writeHeader(
  out: ByteWriter,
  size: number,
  fixed: number,
  type16: number,
  type32: number,
) {
  if (size < 16) {
    out.byte(fixed | size);
  } else if (size <= 0xffff) {
    out.byte(type16);
    out.uint(2, BigInt(size));
  } else {
    out.byte(type32);
    out.uint(4, BigInt(size));
  }
}

function writeLength(
  out: ByteWriter,
  length: number,
  type8: number,
  type16: number,
  type32: number,
) {
  if (length <= 0xff) {
    out.byte(type8);
    out.byte(length);
  } else if (length <= 0xffff) {
    out.byte(type16);
    out.uint(2, BigInt(length));
  } else {
    out.byte(type32);
    out.uint(4, BigInt(length));
  }
}

class ByteWriter {
  private buffer = new Uint8Array(64);
  private length = 0;

  byte(value: number) {
    this.reserve(1);
    this.buffer[this.length++] = value;
  }

  bytes(data: Uint8Array) {
    this.reserve(data.length);
    this.buffer.set(data, this.length);
    this.length += data.length;
  }

  /** Big-endian, `size` bytes wide. */
  uint(size: number, value: bigint) {
    for (let index = size - 1; index >= 0; index -= 1) {
      this.byte(Number((value >> BigInt(index * 8)) & BYTE_MASK));
    }
  }

  float32(value: number) {
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, value);
    this.bytes(new Uint8Array(view.buffer));
  }

  float64(value: number) {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value);
    this.bytes(new Uint8Array(view.buffer));
  }

  result() {
    return this.buffer.slice(0, this.length);
  }

  private reserve(extra: number) {
    if (this.length + extra <= this.buffer.length) return;

    let size = this.buffer.length * 2;
    while (size < this.length + extra) size *= 2;

    const next = new Uint8Array(size);
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
  }
}

function isObject(value: Json): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** {"$base64": "…"}: bytes that were neither text nor gob. */
function isRawBytes(value: Json): value is { $base64: string } {
  return (
    isObject(value) &&
    Object.keys(value).length === 1 &&
    typeof value.$base64 === "string"
  );
}

/** {"$ext": n, "$base64": "…"}: an extension type this tool has no reader for. */
function isRawExt(value: Json): value is { $ext: number; $base64: string } {
  return (
    isObject(value) &&
    Object.keys(value).length === 2 &&
    typeof value.$base64 === "string" &&
    typeof value.$ext === "number" &&
    Number.isInteger(value.$ext) &&
    value.$ext >= -128 &&
    value.$ext <= 127
  );
}

function decodeBase64Field(value: string, path: Path) {
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(value)) {
    throw expected(path, "valid Base64");
  }
  return decodeBase64(value, `${formatPath(path)} must be valid Base64.`);
}

function decodeBase64(value: string, message: string) {
  const unpadded = value
    .replace(/=+$/, "")
    .replaceAll("-", "+")
    .replaceAll("_", "/");

  if (unpadded.length % 4 === 1) throw new Error(message);

  try {
    const binary = atob(
      unpadded + "=".repeat((4 - (unpadded.length % 4)) % 4),
    );
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error(message);
  }
}

function readableText(data: Uint8Array) {
  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    return null;
  }

  // Control characters other than tab and newlines mean binary, not text.
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text) ? null : text;
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

function jsonKey(key: Json) {
  return typeof key === "string" ? key : JSON.stringify(key);
}

/** Exact as a number when it fits; past 2^53 a string keeps every digit. */
function bigintToJson(value: bigint): Json {
  return value <= MAX_SAFE && value >= MIN_SAFE ? Number(value) : value.toString();
}

function encodeBase64(data: Uint8Array) {
  let binary = "";

  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
