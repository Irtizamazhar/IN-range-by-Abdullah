/** Accept raster bytes only when their signature agrees with the declared MIME. */
export function imageExtension(bytes: Uint8Array, rawMime: string): "png" | "jpg" | "webp" | null {
  const mime=rawMime.toLowerCase().split(";")[0].trim();
  if (["image/jpeg","image/jpg"].includes(mime)&&bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255) return "jpg";
  if (mime==="image/png"&&bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return "png";
  if (mime==="image/webp"&&bytes.length>=12&&[82,73,70,70].every((v,i)=>bytes[i]===v)&&[87,69,66,80].every((v,i)=>bytes[i+8]===v)) return "webp";
  return null;
}
