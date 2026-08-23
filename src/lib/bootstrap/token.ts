import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET n'est pas défini");
  }
  return new TextEncoder().encode(secret);
}

export interface BootstrapTokenPayload {
  requestId: string;
  userId: string;
}

export async function signBootstrapToken(payload: BootstrapTokenPayload): Promise<string> {
  return await new SignJWT({ ...payload, type: "bootstrap" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret());
}

export async function verifyBootstrapToken(token: string): Promise<BootstrapTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.type !== "bootstrap") return null;
    return {
      requestId: payload.requestId as string,
      userId: payload.userId as string,
    };
  } catch {
    return null;
  }
}
