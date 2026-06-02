import client from "./client";
import type { TokenResponse, User } from "./types";

export async function register(username: string, password: string): Promise<User> {
  const { data } = await client.post("/auth/register", { username, password });
  return data;
}

export async function login(username: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post("/auth/login", { username, password });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await client.get("/auth/me");
  return data;
}
