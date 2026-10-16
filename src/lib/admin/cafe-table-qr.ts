import "server-only";

import QRCode from "qrcode";

import { tableUrl } from "./cafe-tables-core";

/**
 * The SVG printed on a table: its `/masa/<code>` URL at error-correction
 * level Q with the four-module quiet zone ISO/IEC 18004 asks for - the same
 * settings as the till QR (`api/mobile/v1/me/counter-token`). A table card
 * is laminated, wiped and set down in coffee, so a quarter of the code may be
 * lost and it still reads.
 */
export async function tableQrSvg(code: string): Promise<string> {
  return QRCode.toString(tableUrl(code), {
    type: "svg",
    errorCorrectionLevel: "Q",
    margin: 4,
  });
}
