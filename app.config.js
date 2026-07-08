const { existsSync, writeFileSync } = require("fs");
const { expo } = require("./app.json");

const googleServicesPath = "./google-services.json";

if (process.env.GOOGLE_SERVICES_JSON && !existsSync(googleServicesPath)) {
  writeFileSync(googleServicesPath, process.env.GOOGLE_SERVICES_JSON);
}

export default {
  expo: {
    ...expo,
    android: {
      ...expo.android,
      googleServicesFile: existsSync(googleServicesPath) ? googleServicesPath : undefined,
    },
  },
};
