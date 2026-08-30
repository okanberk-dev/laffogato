import { describe, expect, it } from "vitest";

import { poolConfig } from "@/lib/db/index";

describe("pool configuration", () => {
  const neon =
    "postgresql://user:pw@ep-x-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  it("keeps TLS on for a provider URL that asks for it", () => {
    expect(poolConfig(neon).ssl).toEqual({ rejectUnauthorized: true });
  });

  it("strips the SSL params pg would warn about", () => {
    // pg-connection-string treats sslmode=require as a deprecated alias and
    // logs a warning on every cold start, which lands in the platform logs at
    // error level. TLS is configured explicitly instead.
    const cs = poolConfig(neon).connectionString as string;
    expect(cs).not.toContain("sslmode");
    expect(cs).not.toContain("channel_binding");
    expect(cs).toContain("ep-x-pooler.c-5.us-east-2.aws.neon.tech");
    expect(cs).toContain("/neondb");
  });

  it("leaves TLS off for a local database that does not ask for it", () => {
    expect(poolConfig("postgresql://laffo@127.0.0.1:5432/laffogato").ssl).toBe(
      undefined,
    );
  });

  it("honours an explicit sslmode=disable", () => {
    expect(
      poolConfig("postgresql://laffo@127.0.0.1:5432/db?sslmode=disable").ssl,
    ).toBe(undefined);
  });

  it("gives a cold start room to reach a waking pooler", () => {
    // Too short a timeout degrades the first request after an idle period,
    // which shows the visitor a fallback page for no reason.
    expect(poolConfig(neon).connectionTimeoutMillis).toBeGreaterThanOrEqual(
      10_000,
    );
  });

  it("keeps one connection per instance", () => {
    expect(poolConfig(neon).max).toBe(1);
  });
});

describe("Supabase TLS emniyeti", () => {
  const POOLER =
    "postgresql://postgres.ref:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";

  it("sslmode'suz bir Supabase dizesinde TLS'i yine de açar", () => {
    // Supavisor düz metin oturumu kabul eder; sslmode'u unutulmuş bir dize
    // üretim trafiğini sessizce şifresiz taşımamalı.
    const cfg = poolConfig(POOLER);
    expect(cfg.ssl).toBeTruthy();
  });

  it("Supabase olmayan yerel dizede TLS varsayılanını değiştirmez", () => {
    const cfg = poolConfig("postgresql://postgres@localhost:5432/test");
    expect(cfg.ssl).toBeUndefined();
  });

  it("DATABASE_SSL_CA verildiğinde tam doğrulamayı özel kökle yapar", () => {
    const prev = process.env.DATABASE_SSL_CA;
    process.env.DATABASE_SSL_CA = "-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----";
    try {
      const cfg = poolConfig(POOLER + "?sslmode=require");
      expect(cfg.ssl).toMatchObject({
        rejectUnauthorized: true,
        ca: expect.stringContaining("BEGIN CERTIFICATE"),
      });
    } finally {
      if (prev === undefined) delete process.env.DATABASE_SSL_CA;
      else process.env.DATABASE_SSL_CA = prev;
    }
  });

  it("BÜYÜK harfli Supabase host'u da emniyeti tetikler", () => {
    // postgresql: özel olmayan şemadır — WHATWG host'u küçültmez; kilit harfe
    // duyarlı olsaydı DNS harfe duyarsız olduğu için düz metin bağlantı
    // BAŞARILI olurdu.
    const cfg = poolConfig(
      "postgresql://p:pw@AWS-0-EU-CENTRAL-1.POOLER.SUPABASE.COM:6543/postgres",
    );
    expect(cfg.ssl).toBeTruthy();
  });

  it("Supabase host'unda açık sslmode=disable bile TLS'i kapatamaz", () => {
    // Bilinçli: bu bir kullanıcı tercihi değil emniyet kilidi. Supavisor düz
    // metni kabul eder; disable'a saygı, üretimi şifresiz taşımak demek olurdu.
    const cfg = poolConfig(POOLER + "?sslmode=disable");
    expect(cfg.ssl).toMatchObject({ rejectUnauthorized: true });
  });

  it("DATABASE_SSL_CA Neon dizesine SIZMAZ — tek adımlık geri dönüş korunur", () => {
    const prev = process.env.DATABASE_SSL_CA;
    process.env.DATABASE_SSL_CA = "-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----";
    try {
      const cfg = poolConfig(
        "postgresql://user:pw@ep-x-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
      );
      // Node'da ca, sistem köklerinin YERİNE geçer; Neon'a dönüşte bu env
      // unutulmuş olsa bile halka açık kökle el sıkışma bozulmamalı.
      expect(cfg.ssl).toEqual({ rejectUnauthorized: true });
    } finally {
      if (prev === undefined) delete process.env.DATABASE_SSL_CA;
      else process.env.DATABASE_SSL_CA = prev;
    }
  });

  it("PEM görünmeyen DATABASE_SSL_CA yok sayılır (gürültülü)", () => {
    const prev = process.env.DATABASE_SSL_CA;
    process.env.DATABASE_SSL_CA = "bu bir sertifika degil";
    try {
      const cfg = poolConfig(POOLER);
      expect(cfg.ssl).toEqual({ rejectUnauthorized: true });
    } finally {
      if (prev === undefined) delete process.env.DATABASE_SSL_CA;
      else process.env.DATABASE_SSL_CA = prev;
    }
  });

  it("rejectUnauthorized:false diye bir yol SUNMAZ", () => {
    // "Şifreli ama doğrulanmamış" en kötü sessiz arızadır; sağlık katmanı da
    // TLS hatasını "veritabanı ulaşılamıyor" sayıp paket veriye düşer — yani
    // yanlış yapılandırma 500 yerine "boş site" olarak görünür. Kapı yok.
    const cfg = poolConfig(POOLER + "?sslmode=require");
    expect(cfg.ssl).toMatchObject({ rejectUnauthorized: true });
  });
});
