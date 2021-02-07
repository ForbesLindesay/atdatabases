/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');

const CompLibrary = require('../../core/CompLibrary.js');

const MarkdownBlock = CompLibrary.MarkdownBlock; /* Used to read markdown */
const Container = CompLibrary.Container;
const GridBlock = CompLibrary.GridBlock;

class HomeSplash extends React.Component {
  render() {
    const {siteConfig, language = ''} = this.props;
    const {baseUrl, docsUrl} = siteConfig;
    const docsPart = `${docsUrl ? `${docsUrl}/` : ''}`;
    // const langPart = `${language ? `${language}/` : ''}`;
    const docUrl = (doc) => `${baseUrl}${docsPart}${doc}`;

    const SplashContainer = (props) => (
      <div className="homeContainer" style={{background: '#FA2B3A'}}>
        <div className="homeSplashFade">
          <div className="wrapper homeWrapper">{props.children}</div>
        </div>
      </div>
    );

    const ProjectTitle = () => (
      <h2 className="projectTitle">
        <img src={`${baseUrl}img/word-mark.svg`} />
        <small style={{color: 'white'}}>{siteConfig.tagline}</small>
      </h2>
    );

    const PromoSection = (props) => (
      <div className="section promoSection">
        <div className="promoRow">
          <div className="pluginRowBlock">{props.children}</div>
        </div>
      </div>
    );

    const Button = (props) => (
      <div className="pluginWrapper buttonWrapper">
        <a className="button" href={props.href} target={props.target}>
          {props.children}
        </a>
      </div>
    );

    return (
      <SplashContainer>
        <div className="inner">
          <ProjectTitle siteConfig={siteConfig} />
          <PromoSection>
            <Button href={docUrl('sql')}>Getting Started</Button>
          </PromoSection>
        </div>
      </SplashContainer>
    );
  }
}

class Index extends React.Component {
  render() {
    const {config: siteConfig, language = ''} = this.props;
    const {baseUrl, docsUrl} = siteConfig;
    const docsPart = `${docsUrl ? `${docsUrl}/` : ''}`;
    // const langPart = `${language ? `${language}/` : ''}`;
    const docUrl = (doc) => `${baseUrl}${docsPart}${doc}`;

    const Block = (props) => (
      <Container
        padding={['bottom', 'top']}
        id={props.id}
        background={props.background}
      >
        <GridBlock
          align="center"
          contents={props.children}
          layout={props.layout}
        />
      </Container>
    );

    const FeatureCallout = () => (
      <div
        className="productShowcaseSection paddingBottom"
        style={{textAlign: 'center'}}
      >
        <img src={`${baseUrl}img/padlock.svg`} width="100" height="100" />
        <h2>Safe From SQL Injection</h2>
        <MarkdownBlock>
          {`Using tagged template literals for queries, e.g.
\`\`\`ts
db.query(sql\`SELECT * FROM users WHERE id=\${userID}\`);
\`\`\`

makes it virtually impossible for SQL Injection attacks to slip in
un-noticed. All the \`@databases\` libraries enforce the use of the sql
tagged template literals, so you can't accidentally miss them.

The query is then passed to your database engine as a separate string and values:

\`\`\`
{text: 'SELECT * FROM users WHERE id=?', values: [userID]}
\`\`\`
`}
        </MarkdownBlock>
      </div>
    );

    const TryOut = () => (
      <Block id="try">
        {[
          {
            content:
              'Written in TypeScript, so every module has type safety and type definitions built in.',
            image: `${baseUrl}img/typescript.svg`,
            imageAlign: 'left',
            title: 'Type Safe',
          },
        ]}
      </Block>
    );

    const Description = () => (
      <Block background="dark">
        {[
          {
            content:
              'Each database driver is published to npm as a separate module.',
            image: `${baseUrl}img/npm.svg`,
            imageAlign: 'right',
            title: 'Modular',
          },
        ]}
      </Block>
    );

    const LearnHow = () => (
      <Block background="light">
        {[
          {
            content:
              'All the @databases APIs are designed with promises in mind from the get go.',
            image: `${baseUrl}img/promises.svg`,
            imageAlign: 'right',
            title: 'Promises',
          },
        ]}
      </Block>
    );

    const Features = () => (
      <Block layout="fourColumn">
        {[
          {
            // content: 'This is the content of my feature',
            image: `${baseUrl}img/postgres.svg`,
            imageAlign: 'top',
            title: `[Postgres](${docUrl('pg')})`,
          },
          {
            // content: 'The content of my second feature',
            image: `${baseUrl}img/mysql.svg`,
            imageAlign: 'top',
            title: `[MySQL](${docUrl('mysql')})`,
          },
          {
            // content: 'The content of my second feature',
            image: `${baseUrl}img/sqlite.svg`,
            imageAlign: 'top',
            title: `[SQLite](${docUrl('sqlite')})`,
          },
          {
            // content: 'The content of my second feature',
            image: `${baseUrl}img/expo.svg`,
            imageAlign: 'top',
            title: `[Expo/WebSQL](${docUrl('websql')})`,
          },
        ]}
      </Block>
    );

    const Showcase = () => {
      if ((siteConfig.users || []).length === 0) {
        return null;
      }

      const showcase = siteConfig.users
        .filter((user) => user.pinned)
        .map((user) => (
          <a href={user.infoLink} key={user.infoLink}>
            <img src={user.image} alt={user.caption} title={user.caption} />
          </a>
        ));

      const pageUrl = (page) => baseUrl + page;

      return (
        <div className="productShowcaseSection paddingBottom">
          <h2>Who is Using This?</h2>
          <p>This project is used by all these people</p>
          <div className="logos">{showcase}</div>
          <div className="more-users">
            <a className="button" href={pageUrl('users')}>
              More {siteConfig.title} Users
            </a>
          </div>
        </div>
      );
    };

    return (
      <div>
        <HomeSplash siteConfig={siteConfig} language={language} />
        <div className="mainContainer">
          <Features />
          <FeatureCallout />
          <LearnHow />
          <TryOut />
          <Description />
          <Showcase />
        </div>
      </div>
    );
  }
}

module.exports = Index;
