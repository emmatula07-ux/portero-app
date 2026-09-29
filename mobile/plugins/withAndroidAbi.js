const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Fija las arquitecturas de build (teléfonos reales, sin emuladores x86)
// en gradle.properties, de forma persistente tras cada prebuild.
const TARGET = "reactNativeArchitectures=arm64-v8a,armeabi-v7a";

module.exports = function withAndroidAbi(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const gradleProps = path.join(
        config.modRequest.platformProjectRoot,
        "gradle.properties",
      );
      if (fs.existsSync(gradleProps)) {
        let content = fs.readFileSync(gradleProps, "utf8");
        if (/^reactNativeArchitectures=/m.test(content)) {
          content = content.replace(/^reactNativeArchitectures=.*$/m, TARGET);
        } else {
          content += "\n" + TARGET + "\n";
        }
        fs.writeFileSync(gradleProps, content);
      }
      return config;
    },
  ]);
};
