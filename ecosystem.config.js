module.exports = {
    apps : [{
      name: "app",
      script: "./app.js",
      env_stage: {
        NODE_ENV: "stage",
      },
      env_prod: {
        NODE_ENV: "prod",
      }
    }]
  }