export default class {

  constructor(runtime) {
    this.runtime = runtime;
  }

  getPrimitives() {
    return {
      mock_say_hello: this.sayHello,
    };
  }

  sayHello() {
    console.log('Hello from scratch3-bell-mock!');
  }
};
