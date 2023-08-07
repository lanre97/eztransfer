import { uniqueNamesGenerator, adjectives, animals, colors } from "unique-names-generator";

const generateRandomName = () => {
  const randomName = uniqueNamesGenerator({ 
    dictionaries: [adjectives, animals, colors],
    separator: ' ',
  });
  return randomName
}

export default generateRandomName