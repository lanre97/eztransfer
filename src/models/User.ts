export default class User {
  constructor(public readonly id: string, public readonly name: string) {
    
  }

  public toJSON() {
    return {
      id: this.id,
      name: this.name,
    }
  }
}