import Image, {
  alt as ogAlt,
  contentType as ogContentType,
  size as ogSize,
} from "./opengraph-image";

export { generateStaticParams } from "./opengraph-image";

export const runtime = "nodejs";
export const revalidate = 3600;
export const alt = ogAlt;
export const size = ogSize;
export const contentType = ogContentType;

export default Image;
