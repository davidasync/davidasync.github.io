export const JWT_ALGORITHMS = [
  "HS256",
  "HS384",
  "HS512",
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES256",
  "ES384",
  "ES512",
] as const;

export type JwtAlgorithm = (typeof JWT_ALGORITHMS)[number];

export type DecodedJwt = {
  headerPart: string;
  payloadPart: string;
  signaturePart: string;
  header: Record<string, unknown>;
  payload: unknown;
  headerJson: string;
  payloadJson: string;
  algorithm: string;
  signingInput: string;
};

export type JwtParseResult =
  | { ok: true; empty: false; token: DecodedJwt }
  | { ok: false; empty: true; error: "" }
  | { ok: false; empty: false; error: string };

export type JwtClaimRow = {
  claim: string;
  label: string;
  value: string;
  detail?: string;
  warning?: string;
};

const HMAC_HASH = {
  HS256: "SHA-256",
  HS384: "SHA-384",
  HS512: "SHA-512",
} as const;

const RSA_HASH = {
  RS256: "SHA-256",
  RS384: "SHA-384",
  RS512: "SHA-512",
  PS256: "SHA-256",
  PS384: "SHA-384",
  PS512: "SHA-512",
} as const;

const ECDSA_PARAMS = {
  ES256: { hash: "SHA-256", namedCurve: "P-256" },
  ES384: { hash: "SHA-384", namedCurve: "P-384" },
  ES512: { hash: "SHA-512", namedCurve: "P-521" },
} as const;

const PSS_SALT = {
  PS256: 32,
  PS384: 48,
  PS512: 64,
} as const;

const REGISTERED_CLAIMS: Record<string, string> = {
  iss: "Issuer",
  sub: "Subject",
  aud: "Audience",
  exp: "Expiration",
  nbf: "Not before",
  iat: "Issued at",
  jti: "JWT ID",
};

const DATE_CLAIMS = new Set(["exp", "nbf", "iat"]);

export const EXAMPLE_JWT_SECRET = "a-string-secret-at-least-256-bits-long";

export const EXAMPLE_JWT_HEADER = {
  alg: "HS256",
  typ: "JWT",
} as const;

export const EXAMPLE_JWT_PAYLOAD = {
  sub: "1234567890",
  name: "John Doe",
  admin: true,
  iat: 1516239022,
} as const;

export function isJwtAlgorithm(value: string): value is JwtAlgorithm {
  return JWT_ALGORITHMS.some((algorithm) => algorithm === value);
}

export function isHmacAlgorithm(
  value: string,
): value is keyof typeof HMAC_HASH {
  return value in HMAC_HASH;
}

export function isAsymmetricAlgorithm(value: string) {
  return value in RSA_HASH || value in ECDSA_PARAMS;
}

export function parseJwt(value: string): JwtParseResult {
  const compact = value.trim().replace(/\s/g, "");

  if (compact === "") {
    return { ok: false, empty: true, error: "" };
  }

  const parts = compact.split(".");

  if (parts.length !== 2 && parts.length !== 3) {
    return {
      ok: false,
      empty: false,
      error: "A JWT must have two or three Base64URL segments separated by dots.",
    };
  }

  const [headerPart, payloadPart, signaturePart = ""] = parts;

  try {
    const header = parseJsonObject(
      decodeUtf8(decodeBase64Url(headerPart)),
      "header",
    );
    const payload = parseJsonValue(
      decodeUtf8(decodeBase64Url(payloadPart)),
      "payload",
    );
    const algorithm =
      typeof header.alg === "string" && header.alg.trim() !== ""
        ? header.alg
        : "";

    if (!algorithm) {
      return {
        ok: false,
        empty: false,
        error: "JWT header is missing a string alg claim.",
      };
    }

    return {
      ok: true,
      empty: false,
      token: {
        headerPart,
        payloadPart,
        signaturePart,
        header,
        payload,
        headerJson: JSON.stringify(header, null, 2),
        payloadJson: JSON.stringify(payload, null, 2),
        algorithm,
        signingInput: `${headerPart}.${payloadPart}`,
      },
    };
  } catch (error) {
    return {
      ok: false,
      empty: false,
      error: error instanceof Error ? error.message : "Unable to decode JWT.",
    };
  }
}

export function jwtClaims(payload: unknown, now = Date.now()): JwtClaimRow[] {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  return Object.entries(payload).map(([claim, raw]) => {
    const row: JwtClaimRow = {
      claim,
      label: REGISTERED_CLAIMS[claim] ?? claim,
      value: formatClaimValue(raw),
    };

    if (!DATE_CLAIMS.has(claim) || typeof raw !== "number" || !Number.isFinite(raw)) {
      return row;
    }

    const date = new Date(raw * 1000);

    if (Number.isNaN(date.getTime())) {
      return row;
    }

    row.detail = `${date.toISOString()} · ${formatRelativeTime(date, now)}`;

    if (claim === "exp" && date.getTime() <= now) {
      row.warning = "expired";
    }

    if (claim === "nbf" && date.getTime() > now) {
      row.warning = "not yet valid";
    }

    return row;
  });
}

export async function signJwt({
  header,
  payload,
  secretOrKey,
  secretIsBase64Url = false,
}: {
  header: Record<string, unknown>;
  payload: unknown;
  secretOrKey: string;
  secretIsBase64Url?: boolean;
}) {
  const algorithm = readAlgorithm(header.alg);
  const headerPart = encodeJson(header);
  const payloadPart = encodeJson(payload);
  const signingInput = `${headerPart}.${payloadPart}`;

  if (algorithm === "none") {
    throw new Error("Unsigned tokens (alg none) cannot be encoded here.");
  }

  if (secretOrKey.trim() === "") {
    throw new Error(
      isHmacAlgorithm(algorithm)
        ? "Enter an HMAC secret to sign the token."
        : "Enter a PEM private key to sign the token.",
    );
  }

  const signature = await createSignature(
    algorithm,
    signingInput,
    secretOrKey,
    secretIsBase64Url,
  );

  return `${signingInput}.${signature}`;
}

export async function verifyJwt(
  value: string,
  secretOrKey: string,
  secretIsBase64Url = false,
) {
  const parsed = parseJwt(value);

  if (!parsed.ok) {
    throw new Error(parsed.empty ? "Paste a JWT to verify." : parsed.error);
  }

  const { algorithm, signingInput, signaturePart } = parsed.token;

  if (algorithm === "none") {
    return signaturePart === "";
  }

  if (!isJwtAlgorithm(algorithm)) {
    throw new Error(`Unsupported algorithm: ${algorithm}.`);
  }

  if (signaturePart === "") {
    return false;
  }

  return verifySignature(
    algorithm,
    signingInput,
    signaturePart,
    secretOrKey,
    secretIsBase64Url,
  );
}

export function hmacSecretWarning(
  algorithm: string,
  secret: string,
  secretIsBase64Url: boolean,
) {
  if (!isHmacAlgorithm(algorithm) || secret.trim() === "") return "";

  try {
    const bytes = secretBytes(secret, secretIsBase64Url);
    const minimum = hashByteLength(HMAC_HASH[algorithm]);

    if (bytes.length < minimum) {
      return `${algorithm} secrets should be at least ${minimum} bytes. This key is ${bytes.length}.`;
    }
  } catch {
    return "";
  }

  return "";
}

function readAlgorithm(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Header must include a string alg.");
  }

  if (value === "none" || isJwtAlgorithm(value)) {
    return value;
  }

  throw new Error(`Unsupported algorithm: ${value}.`);
}

async function createSignature(
  algorithm: JwtAlgorithm,
  signingInput: string,
  secretOrKey: string,
  secretIsBase64Url: boolean,
) {
  const data = textBytes(signingInput);

  if (isHmacAlgorithm(algorithm)) {
    const key = await importHmacKey(algorithm, secretOrKey, secretIsBase64Url, [
      "sign",
    ]);
    return encodeBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, data)));
  }

  if (algorithm in ECDSA_PARAMS) {
    const params = ECDSA_PARAMS[algorithm as keyof typeof ECDSA_PARAMS];
    const key = await importPrivateKey(secretOrKey, {
      name: "ECDSA",
      namedCurve: params.namedCurve,
    });
    return encodeBase64Url(
      new Uint8Array(
        await crypto.subtle.sign({ name: "ECDSA", hash: params.hash }, key, data),
      ),
    );
  }

  if (algorithm.startsWith("PS")) {
    const hash = RSA_HASH[algorithm as keyof typeof RSA_HASH];
    const key = await importPrivateKey(secretOrKey, {
      name: "RSA-PSS",
      hash,
    });
    return encodeBase64Url(
      new Uint8Array(
        await crypto.subtle.sign(
          {
            name: "RSA-PSS",
            saltLength: PSS_SALT[algorithm as keyof typeof PSS_SALT],
          },
          key,
          data,
        ),
      ),
    );
  }

  const hash = RSA_HASH[algorithm as keyof typeof RSA_HASH];
  const key = await importPrivateKey(secretOrKey, {
    name: "RSASSA-PKCS1-v1_5",
    hash,
  });
  return encodeBase64Url(
    new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data)),
  );
}

async function verifySignature(
  algorithm: JwtAlgorithm,
  signingInput: string,
  signaturePart: string,
  secretOrKey: string,
  secretIsBase64Url: boolean,
) {
  const data = textBytes(signingInput);
  const signature = decodeBase64Url(signaturePart);

  if (isHmacAlgorithm(algorithm)) {
    const key = await importHmacKey(algorithm, secretOrKey, secretIsBase64Url, [
      "verify",
    ]);
    return crypto.subtle.verify("HMAC", key, signature, data);
  }

  if (algorithm in ECDSA_PARAMS) {
    const params = ECDSA_PARAMS[algorithm as keyof typeof ECDSA_PARAMS];
    const key = await importPublicKey(secretOrKey, {
      name: "ECDSA",
      namedCurve: params.namedCurve,
    });
    return crypto.subtle.verify(
      { name: "ECDSA", hash: params.hash },
      key,
      signature,
      data,
    );
  }

  if (algorithm.startsWith("PS")) {
    const hash = RSA_HASH[algorithm as keyof typeof RSA_HASH];
    const key = await importPublicKey(secretOrKey, {
      name: "RSA-PSS",
      hash,
    });
    return crypto.subtle.verify(
      {
        name: "RSA-PSS",
        saltLength: PSS_SALT[algorithm as keyof typeof PSS_SALT],
      },
      key,
      signature,
      data,
    );
  }

  const hash = RSA_HASH[algorithm as keyof typeof RSA_HASH];
  const key = await importPublicKey(secretOrKey, {
    name: "RSASSA-PKCS1-v1_5",
    hash,
  });
  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
}

async function importHmacKey(
  algorithm: keyof typeof HMAC_HASH,
  secret: string,
  secretIsBase64Url: boolean,
  usages: KeyUsage[],
) {
  return crypto.subtle.importKey(
    "raw",
    secretBytes(secret, secretIsBase64Url),
    { name: "HMAC", hash: HMAC_HASH[algorithm] },
    false,
    usages,
  );
}

async function importPrivateKey(
  pem: string,
  algorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams,
) {
  try {
    return await crypto.subtle.importKey(
      "pkcs8",
      decodePem(pem, ["PRIVATE KEY"]),
      algorithm,
      false,
      ["sign"],
    );
  } catch (error) {
    throw new Error(keyError("private", error));
  }
}

async function importPublicKey(
  pem: string,
  algorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams,
) {
  try {
    return await crypto.subtle.importKey(
      "spki",
      decodePem(pem, ["PUBLIC KEY"]),
      algorithm,
      false,
      ["verify"],
    );
  } catch (error) {
    throw new Error(keyError("public", error));
  }
}

function keyError(kind: "public" | "private", error: unknown) {
  const detail = error instanceof Error ? error.message : "Invalid key.";

  if (/PEM|BEGIN/.test(detail)) {
    return detail;
  }

  return `Could not import the ${kind} key. Use a PEM ${
    kind === "public" ? "PUBLIC KEY" : "PRIVATE KEY"
  }. ${detail}`;
}

function secretBytes(secret: string, secretIsBase64Url: boolean) {
  if (!secretIsBase64Url) {
    return textBytes(secret);
  }

  try {
    return decodeBase64Url(secret.trim().replace(/\s/g, ""));
  } catch {
    throw new Error("Secret is not valid Base64URL.");
  }
}

function decodePem(pem: string, expected: string[]) {
  const match = pem
    .trim()
    .match(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]+?)-----END \1-----/);

  if (!match) {
    throw new Error(
      `Expected a PEM block (${expected.map((label) => `BEGIN ${label}`).join(" or ")}).`,
    );
  }

  if (!expected.includes(match[1])) {
    throw new Error(
      `Expected ${expected.map((label) => `BEGIN ${label}`).join(" or ")}, got BEGIN ${match[1]}.`,
    );
  }

  try {
    const compact = match[2].replace(/\s/g, "");
    const padded = compact + "=".repeat((4 - (compact.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("PEM body is not valid Base64.");
  }
}

function encodeJson(value: unknown) {
  return encodeBase64Url(textBytes(JSON.stringify(value)));
}

function parseJsonObject(text: string, label: string) {
  const value = parseJsonValue(text, label);

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`JWT ${label} must be a JSON object.`);
  }

  return value as Record<string, unknown>;
}

function parseJsonValue(text: string, label: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    throw new Error(`JWT ${label} is not valid JSON: ${message}`);
  }
}

function formatClaimValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function formatRelativeTime(date: Date, now: number) {
  const seconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 365 * 24 * 60 * 60],
    ["month", 30 * 24 * 60 * 60],
    ["day", 24 * 60 * 60],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, size] of units) {
    if (abs >= size || unit === "second") {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }

  return formatter.format(0, "second");
}

function hashByteLength(hash: "SHA-256" | "SHA-384" | "SHA-512") {
  if (hash === "SHA-256") return 32;
  if (hash === "SHA-384") return 48;
  return 64;
}

function decodeUtf8(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("JWT segment is not valid UTF-8.");
  }
}

export function encodeBase64Url(bytes: Uint8Array) {
  return btoa(bytesToBinary(bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function decodeBase64Url(value: string) {
  if (value === "") {
    return new Uint8Array();
  }

  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("JWT segment is not valid Base64URL.");
  }

  try {
    const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("JWT segment is not valid Base64URL.");
  }
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

function bytesToBinary(bytes: Uint8Array) {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }

  return binary;
}
