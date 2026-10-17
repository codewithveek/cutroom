import { z } from "zod";
import { hexColorSchema } from "./primitives";

export const brandSchema = z.object({
  name: z.string().min(1).max(40),
  tagline: z.string().max(90).optional(),
  accentColor: hexColorSchema.optional(),
  fontFamily: z.string().min(1).optional(),
  logoAssetKey: z.string().min(1).optional(),
  url: z.string().max(80).optional(),
});
export type Brand = z.infer<typeof brandSchema>;
