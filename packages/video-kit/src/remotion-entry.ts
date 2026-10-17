import { registerRoot, staticFile } from "remotion";
import { RemotionRoot } from "./compositions/remotion-root";
import { loadCutroomFonts } from "./fonts/load-fonts";

loadCutroomFonts((fileName) => staticFile(`fonts/${fileName}`));
registerRoot(RemotionRoot);
