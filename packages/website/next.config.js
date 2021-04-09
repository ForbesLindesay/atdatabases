// See https://github.com/vercel/next.js/issues/22813
module.exports = {
  future: {
    webpack5: true,
  },
  webpack: (config, {isServer, dev}) => {
    // config.module.rules = config.module.rules.map((rule) => {
    //   if (rule.use?.loader && rule.use.loader === 'next-babel-loader') {
    //     rule.use.options.cacheDirectory = false;
    //   }
    //   return rule;
    // });
    config.output.chunkFilename = isServer
      ? `${dev ? '[name]' : '[name].[fullhash]'}.js`
      : `static/chunks/${dev ? '[name]' : '[name].[fullhash]'}.js`;

    // https://github.com/agershun/alasql#webpack may also be needed?
    return config;
  },
};
