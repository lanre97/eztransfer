export default class DropFile {
  constructor(public readonly file: File, public readonly id: string) {
    
  }

  public get name() {
    return this.file.name;
  }

  public get size() {
    return this.file.size;
  }
}