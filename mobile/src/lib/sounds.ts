import { createAudioPlayer } from "expo-audio";

const successPlayer = createAudioPlayer(require("../../assets/sounds/success.wav"));
const errorPlayer = createAudioPlayer(require("../../assets/sounds/error.wav"));

async function replay(player: ReturnType<typeof createAudioPlayer>) {
  try {
    await player.seekTo(0);
    player.play();
  } catch (e) {
    console.warn("No se pudo reproducir el sonido:", e);
  }
}

export function playSuccessSound() {
  replay(successPlayer);
}

export function playErrorSound() {
  replay(errorPlayer);
}
