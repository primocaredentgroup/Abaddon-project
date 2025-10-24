const authConfig = {
  providers: [
    {
      domain: process.env.AUTH0_DOMAIN!,
      applicationID: process.env.AUTH0_CLIENT_ID!,
    },
  ],
}

export default authConfig
