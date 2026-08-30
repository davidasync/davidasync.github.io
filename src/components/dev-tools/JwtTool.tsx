"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EXAMPLE_JWT_HEADER,
  EXAMPLE_JWT_PAYLOAD,
  EXAMPLE_JWT_SECRET,
  JWT_ALGORITHMS,
  hmacSecretWarning,
  isAsymmetricAlgorithm,
  isHmacAlgorithm,
  isJwtAlgorithm,
  jwtClaims,
  parseJwt,
  signJwt,
  verifyJwt,
  type JwtAlgorithm,
  type JwtParseResult,
} from "@/lib/dev-tools/jwt";

type Mode = "decode" | "encode";
type Notice = { kind: "success" | "error"; message: string };
type SignatureState =
  | { key: string; status: "valid" }
  | { key: string; status: "invalid" }
  | { key: string; status: "error"; message: string };

const headerButtonClass =
  "inline-flex items-center justify-center rounded-sm border px-2 py-1 text-[10px] uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50";

const textareaClass =
  "w-full resize-y rounded-sm border border-border bg-background/70 p-4 text-sm leading-6 text-foreground transition placeholder:text-muted/55 hover:border-accent/40 focus:border-accent focus:outline-none";

const defaultHeader = JSON.stringify(EXAMPLE_JWT_HEADER, null, 2);
const defaultPayload = JSON.stringify(EXAMPLE_JWT_PAYLOAD, null, 2);

export default function JwtTool() {
  const [mode, setMode] = useState<Mode>("decode");
  const [token, setToken] = useState("");
  const [headerText, setHeaderText] = useState(defaultHeader);
  const [payloadText, setPayloadText] = useState(defaultPayload);
  const [secret, setSecret] = useState("");
  const [secretIsBase64Url, setSecretIsBase64Url] = useState(false);
  const [algorithm, setAlgorithm] = useState<JwtAlgorithm>("HS256");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [signature, setSignature] = useState<SignatureState | null>(null);

  const parsed = useMemo(() => parseJwt(token), [token]);
  const decodedHeader = parsed.ok ? parsed.token.headerJson : "";
  const decodedPayload = parsed.ok ? parsed.token.payloadJson : "";
  const claims = parsed.ok ? jwtClaims(parsed.token.payload) : [];
  const tokenAlgorithm = parsed.ok ? parsed.token.algorithm : "";
  const verifyAlgorithm = parsed.ok ? tokenAlgorithm : algorithm;
  const verifyKey = `${token}\0${secret}\0${secretIsBase64Url}\0${verifyAlgorithm}`;
  const signatureStatus =
    signature?.key === verifyKey ? signature : null;
  const secretWarning = hmacSecretWarning(
    mode === "decode" ? verifyAlgorithm : algorithm,
    secret,
    secretIsBase64Url,
  );

  useEffect(() => {
    if (mode !== "decode" || !parsed.ok || secret.trim() === "") {
      return;
    }

    const key = verifyKey;
    let cancelled = false;

    verifyJwt(token, secret, secretIsBase64Url).then(
      (ok) => {
        if (!cancelled) {
          setSignature({ key, status: ok ? "valid" : "invalid" });
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setSignature({
            key,
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to verify signature.",
          });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [mode, parsed.ok, secret, secretIsBase64Url, token, verifyKey]);

  const selectMode = (next: Mode) => {
    if (next === "encode" && parsed.ok) {
      setHeaderText(parsed.token.headerJson);
      setPayloadText(parsed.token.payloadJson);
      if (isJwtAlgorithm(parsed.token.algorithm)) {
        setAlgorithm(parsed.token.algorithm);
      }
    }

    setMode(next);
    setNotice(null);
  };

  const changeAlgorithm = (next: JwtAlgorithm) => {
    setAlgorithm(next);
    setHeaderText((current) => applyAlgorithm(current, next));
    setNotice(null);
  };

  const encode = async () => {
    setNotice(null);

    try {
      const header = parseEditorObject(headerText, "header");
      const payload = parseEditorValue(payloadText, "payload");
      const next = await signJwt({
        header: { ...header, alg: algorithm },
        payload,
        secretOrKey: secret,
        secretIsBase64Url,
      });

      setHeaderText(JSON.stringify({ ...header, alg: algorithm }, null, 2));
      setToken(next);
      setNotice({
        kind: "success",
        message: `Token signed with ${algorithm}.`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Unable to encode JWT.",
      });
    }
  };

  const loadExample = async () => {
    try {
      const next = await signJwt({
        header: { ...EXAMPLE_JWT_HEADER },
        payload: { ...EXAMPLE_JWT_PAYLOAD },
        secretOrKey: EXAMPLE_JWT_SECRET,
      });

      setMode("decode");
      setAlgorithm("HS256");
      setHeaderText(defaultHeader);
      setPayloadText(defaultPayload);
      setSecret(EXAMPLE_JWT_SECRET);
      setSecretIsBase64Url(false);
      setToken(next);
      setNotice({
        kind: "success",
        message: "Example HS256 token loaded.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to generate the example token.",
      });
    }
  };

  const copy = async (value: string, label: string) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setNotice({ kind: "success", message: `${label} copied to clipboard.` });
    } catch {
      setNotice({ kind: "error", message: "Clipboard access was denied." });
    }
  };

  const clear = () => {
    setToken("");
    setHeaderText(defaultHeader);
    setPayloadText(defaultPayload);
    setSecret("");
    setSecretIsBase64Url(false);
    setAlgorithm("HS256");
    setSignature(null);
    setNotice(null);
  };

  const headerView = mode === "decode" ? decodedHeader : headerText;
  const payloadView = mode === "decode" ? decodedPayload : payloadText;
  const busy = hasContent(token, headerText, payloadText, secret);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ModeToggle value={mode} onChange={selectMode} />
        {mode === "encode" ? (
          <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted">
            alg
            <select
              value={algorithm}
              onChange={(event) =>
                changeAlgorithm(event.target.value as JwtAlgorithm)
              }
              className="rounded-sm border border-border bg-background/70 px-2 py-1 text-xs uppercase tracking-wide text-foreground focus:border-accent focus:outline-none"
            >
              {JWT_ALGORITHMS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="mb-4 min-h-6 text-xs" aria-live="polite">
        <StatusLine
          mode={mode}
          notice={notice}
          parsed={parsed}
          secret={secret}
          signature={signatureStatus}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="block">
          <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
              encoded token
            </span>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => void loadExample()}
                className={`${headerButtonClass} border-border bg-surface-2 text-muted hover:border-accent/60 hover:text-accent`}
              >
                example
              </button>
              <button
                type="button"
                onClick={() => void copy(token, "Token")}
                disabled={!token}
                className={`${headerButtonClass} border-border bg-surface-2 text-muted hover:border-accent/60 hover:text-accent`}
              >
                copy
              </button>
              {mode === "encode" ? (
                <button
                  type="button"
                  onClick={() => void encode()}
                  className={`${headerButtonClass} border-accent bg-accent text-accent-contrast hover:brightness-110`}
                >
                  encode
                </button>
              ) : null}
              <button
                type="button"
                onClick={clear}
                disabled={!busy}
                className={`${headerButtonClass} border-transparent text-muted hover:border-border hover:text-foreground`}
              >
                clear
              </button>
            </div>
          </div>
          <TokenField
            value={token}
            readOnly={mode === "encode"}
            parsed={parsed}
            onChange={(value) => {
              setToken(value);
              setNotice(null);
            }}
          />
          {parsed.ok ? (
            <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted">
              <span className="text-terminal-red">header</span>
              <span className="mx-2 text-border">·</span>
              <span className="text-terminal-yellow">payload</span>
              <span className="mx-2 text-border">·</span>
              <span className="text-terminal-cyan">signature</span>
              <span className="mx-2 text-border">·</span>
              {parsed.token.algorithm}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4">
          <JsonField
            label="decoded header"
            value={headerView}
            readOnly={mode === "decode"}
            empty={"Paste a token to decode its header."}
            onChange={(value) => {
              setHeaderText(value);
              setNotice(null);
            }}
            onCopy={() => void copy(headerView, "Header")}
          />
          <JsonField
            label="decoded payload"
            value={payloadView}
            readOnly={mode === "decode"}
            empty={"Paste a token to decode its payload."}
            onChange={(value) => {
              setPayloadText(value);
              setNotice(null);
            }}
            onCopy={() => void copy(payloadView, "Payload")}
          />
          <SecretField
            mode={mode}
            algorithm={mode === "decode" && tokenAlgorithm ? tokenAlgorithm : algorithm}
            secret={secret}
            secretIsBase64Url={secretIsBase64Url}
            warning={secretWarning}
            onChange={(value) => {
              setSecret(value);
              setNotice(null);
            }}
            onToggleEncoding={setSecretIsBase64Url}
            onCopy={() => void copy(secret, "Secret")}
          />
        </div>
      </div>

      {claims.length > 0 ? <ClaimsTable rows={claims} /> : null}
    </div>
  );
}

function ModeToggle({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (value: Mode) => void;
}) {
  return (
    <div
      className="flex rounded-sm border border-border bg-background/60 p-0.5"
      aria-label="JWT mode"
    >
      {(["decode", "encode"] as const).map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={value === item}
          onClick={() => onChange(item)}
          className={`rounded-sm px-3 py-1.5 text-[10px] uppercase tracking-wide transition ${
            value === item
              ? "bg-accent-soft text-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function StatusLine({
  mode,
  notice,
  parsed,
  secret,
  signature,
}: {
  mode: Mode;
  notice: Notice | null;
  parsed: JwtParseResult;
  secret: string;
  signature: SignatureState | null;
}) {
  if (notice) {
    return (
      <p className={notice.kind === "error" ? "text-terminal-red" : "text-accent"}>
        <span className="mr-2">
          [{notice.kind === "error" ? "error" : "ok"}]
        </span>
        {notice.message}
      </p>
    );
  }

  if (mode === "encode") {
    return (
      <p className="text-muted">
        <span className="mr-2 text-accent">[ready]</span>
        Sign a header and payload locally. Secrets never leave this browser.
      </p>
    );
  }

  if (parsed.empty) {
    return (
      <p className="text-muted">
        <span className="mr-2 text-accent">[ready]</span>
        Paste a JWT to decode it. Verification stays on your device.
      </p>
    );
  }

  if (!parsed.ok) {
    return (
      <p className="text-terminal-red">
        <span className="mr-2">[error]</span>
        {parsed.error}
      </p>
    );
  }

  if (parsed.token.algorithm === "none") {
    return (
      <p className="text-terminal-yellow">
        <span className="mr-2">[warn]</span>
        Valid JWT structure, but the token is unsigned (alg none).
      </p>
    );
  }

  if (secret.trim() === "") {
    return (
      <p className="text-accent">
        <span className="mr-2">[ok]</span>
        Valid JWT. Enter a {isHmacAlgorithm(parsed.token.algorithm) ? "secret" : "public key"} to verify the signature.
      </p>
    );
  }

  if (!signature) {
    return (
      <p className="text-muted">
        <span className="mr-2 text-accent">[ready]</span>
        Checking signature…
      </p>
    );
  }

  if (signature.status === "valid") {
    return (
      <p className="text-accent">
        <span className="mr-2">[ok]</span>
        Valid JWT. Signature verified.
      </p>
    );
  }

  if (signature.status === "error") {
    return (
      <p className="text-terminal-red">
        <span className="mr-2">[error]</span>
        {signature.message}
      </p>
    );
  }

  return (
    <p className="text-terminal-red">
      <span className="mr-2">[error]</span>
      Valid JWT, but the signature does not match this
      {isHmacAlgorithm(parsed.token.algorithm) ? " secret" : " public key"}.
    </p>
  );
}

function TokenField({
  value,
  readOnly,
  parsed,
  onChange,
}: {
  value: string;
  readOnly: boolean;
  parsed: JwtParseResult;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <textarea
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Encoded JWT"
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        spellCheck={false}
        className={`${textareaClass} min-h-72`}
      />
      {parsed.ok ? (
        <pre className="mt-2 max-h-32 overflow-auto rounded-sm border border-border bg-surface-2/70 p-3 text-xs leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]">
          <span className="text-terminal-red">{parsed.token.headerPart}</span>
          <span className="text-muted">.</span>
          <span className="text-terminal-yellow">{parsed.token.payloadPart}</span>
          <span className="text-muted">.</span>
          <span className="text-terminal-cyan">{parsed.token.signaturePart}</span>
        </pre>
      ) : null}
    </div>
  );
}

function JsonField({
  label,
  value,
  readOnly,
  empty,
  onChange,
  onCopy,
}: {
  label: string;
  value: string;
  readOnly: boolean;
  empty: string;
  onChange: (value: string) => void;
  onCopy: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
          {label}
        </span>
        <button
          type="button"
          onClick={onCopy}
          disabled={!value}
          className={`${headerButtonClass} border-border bg-surface-2 text-muted hover:border-accent/60 hover:text-accent`}
        >
          copy
        </button>
      </div>
      <textarea
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        placeholder={empty}
        spellCheck={false}
        className={`${textareaClass} min-h-40`}
      />
    </div>
  );
}

function SecretField({
  mode,
  algorithm,
  secret,
  secretIsBase64Url,
  warning,
  onChange,
  onToggleEncoding,
  onCopy,
}: {
  mode: Mode;
  algorithm: string;
  secret: string;
  secretIsBase64Url: boolean;
  warning: string;
  onChange: (value: string) => void;
  onToggleEncoding: (value: boolean) => void;
  onCopy: () => void;
}) {
  const hmac = isHmacAlgorithm(algorithm);
  const asymmetric = isAsymmetricAlgorithm(algorithm);
  const label = hmac
    ? "HMAC secret"
    : mode === "encode"
      ? "private key"
      : "public key";

  return (
    <div>
      <div className="mb-2 flex min-h-6 flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
          {label}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {hmac ? (
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted">
              <input
                type="checkbox"
                checked={secretIsBase64Url}
                onChange={(event) => onToggleEncoding(event.target.checked)}
                className="accent-accent"
              />
              Base64URL
            </label>
          ) : null}
          <button
            type="button"
            onClick={onCopy}
            disabled={!secret}
            className={`${headerButtonClass} border-border bg-surface-2 text-muted hover:border-accent/60 hover:text-accent`}
          >
            copy
          </button>
        </div>
      </div>
      <textarea
        value={secret}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        placeholder={
          hmac
            ? "Enter the HMAC secret used to sign this token..."
            : asymmetric
              ? mode === "encode"
                ? "-----BEGIN PRIVATE KEY-----"
                : "-----BEGIN PUBLIC KEY-----"
              : "Signature verification is not available for this algorithm."
        }
        spellCheck={false}
        className={`${textareaClass} ${hmac ? "min-h-24" : "min-h-40"}`}
      />
      {warning ? (
        <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-terminal-yellow">
          {warning}
        </p>
      ) : (
        <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted">
          Optional for decoding. Required to encode or verify.
        </p>
      )}
    </div>
  );
}

function ClaimsTable({
  rows,
}: {
  rows: ReturnType<typeof jwtClaims>;
}) {
  return (
    <section className="mt-6" aria-label="JWT claims">
      <h2 className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted">
        claims breakdown
      </h2>
      <div className="overflow-auto rounded-sm border border-border bg-background/60">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-surface-2 text-[10px] uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">claim</th>
              <th className="px-3 py-2 font-medium">value</th>
              <th className="px-3 py-2 font-medium">detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.claim} className="border-t border-border/60">
                <td className="px-3 py-2 align-top">
                  <span className="text-terminal-cyan">{row.claim}</span>
                  {row.label !== row.claim ? (
                    <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-muted">
                      {row.label}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 align-top whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {row.value}
                </td>
                <td className="px-3 py-2 align-top text-muted">
                  {row.warning ? (
                    <span className="mr-2 text-terminal-red">[{row.warning}]</span>
                  ) : null}
                  {row.detail ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function applyAlgorithm(headerText: string, algorithm: JwtAlgorithm) {
  try {
    const header = parseEditorObject(headerText, "header");
    return JSON.stringify({ ...header, alg: algorithm }, null, 2);
  } catch {
    return JSON.stringify({ alg: algorithm, typ: "JWT" }, null, 2);
  }
}

function parseEditorObject(value: string, label: string) {
  const parsed = parseEditorValue(value, label);

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return parsed as Record<string, unknown>;
}

function parseEditorValue(value: string, label: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    throw new Error(`${label} is not valid JSON: ${message}`);
  }
}

function hasContent(
  token: string,
  headerText: string,
  payloadText: string,
  secret: string,
) {
  return (
    token !== "" ||
    secret !== "" ||
    headerText !== defaultHeader ||
    payloadText !== defaultPayload
  );
}
