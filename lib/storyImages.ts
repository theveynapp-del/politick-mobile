// Local placeholder images for demo stories. Abstract/geometric, not real
// photography of any place or person. Keyed by story id since React
// Native's bundler needs static require() paths, not dynamic strings.
export const storyImages: Record<string, any> = {
  d1: require("../assets/demo/infrastructure.jpg"),
  d2: require("../assets/demo/housing.jpg"),
  g1: require("../assets/demo/world.jpg"),
};
