const { buildFederatedSchema } = require('@apollo/federation');
const fetch = require("node-fetch");
const {
  ApolloGateway,
  LocalGraphQLDataSource,
  RemoteGraphQLDataSource
} = require('@apollo/gateway');
const {gql, ApolloServer} = require("apollo-server")

const missionsTypeDefs = gql`
  type Mission {
    id: ID!
    crew: [Astronaut]
    designation: String!
    startDate: String
    endDate: String
  }

  extend type Astronaut @key(fields: "id") {
    id: ID! @external
    missions: [Mission]
  }

  extend type Query {
    mission(id: ID!): Mission
    missions: [Mission]
  }
`;
const apiUrl = "http://localhost:3000";

const missionsResolvers = {
  Astronaut: {
    async missions(astronaut) {
      const res = await fetch(`${apiUrl}/missions`);
      const missions = await res.json();

      return missions.filter(({ crew }) =>
        crew.includes(parseInt(astronaut.id))
      );
    }
  },
  Mission: {
    crew(mission) {
      return mission.crew.map(id => ({ __typename: "Astronaut", id }));
    }
  },
  Query: {
    mission(_, { id }) {
      return fetch(`${apiUrl}/missions/${id}`).then(res => res.json());
    },
    missions() {
      return fetch(`${apiUrl}/missions`).then(res => res.json());
    }
  }
};

const localServices = {
  missions: {
    schema: {
      typeDefs: missionsTypeDefs,
      resolvers: missionsResolvers
    }
  }
}

const remoteServices = {
  baz: {
    url: 'http://localhost:4001/graphql'
  }
};

const services = {
  ...localServices,
  ...remoteServices
}

// By providing a protocol we trick ApolloGateway into thinking that this is a valid URL;
// otherwise it assumes it's a relative URL, and complains.
const DUMMY_SERVICE_URL = 'https://';

const gateway = new ApolloGateway({
  // We can't use localServiceList and serviceList at the same time,
  // so we pretend the local services are remote, but point the ApolloGateway
  // at LocalGraphQLDataSources instead...
  serviceList: Object.keys(services).map(name => ({
    name,
    url: services[name].url || DUMMY_SERVICE_URL
  })),
  buildService({ name, url }) {
    if (url === DUMMY_SERVICE_URL) {
      return new LocalGraphQLDataSource(
        buildFederatedSchema(
          services[name].schema
        )
      );
    } else {
      return new RemoteGraphQLDataSource({
        url
      });
    }
  }
});

const apolloServer = new ApolloServer({
  gateway,
  subscriptions: false
});

const port = 4000;

apolloServer.listen({ port }).then(({ url }) => {
  console.log(`Missions service ready at ${url}`);
});