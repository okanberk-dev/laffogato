// Mints a customer session cookie for the LOCAL test member (qa@example.com),
// signed with CUSTOMER_SESSION_SECRET from your .env.local (a throwaway local
// value; never a real secret). Writes $QA_DIR/qa/session.txt for member.cjs.
// usage: set -a; . ./.env.local; set +a; node docs/handoff/redesign-2026-11/qa/mint-session.cjs
const crypto = require("crypto");
const fs = require("fs");
const dir = (process.env.QA_DIR || "/tmp/laffogato-qa") + "/qa";
fs.mkdirSync(dir, { recursive: true });
const email = "qa@example.com";
const exp = Date.now() + 7 * 864e5;
const payload = `${email}|${exp}`;
const sig = crypto.createHmac("sha256", process.env.CUSTOMER_SESSION_SECRET).update(payload).digest("hex");
fs.writeFileSync(dir + "/session.txt", `${payload}|${sig}`);
console.log("wrote", dir + "/session.txt");
