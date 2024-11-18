declare module 'undefined/global-auto' {
  export * from 'undefined/vm/service';
  export * from 'undefined/vm/runner';
  export * from 'undefined/vm/memory';
  export * from 'undefined/vm/broker';
  export * from 'undefined/models/xrm/reference';
  export * from 'undefined/models/xrm/lookup';
  export * from 'undefined/models/xrm/entity';
  export * from 'undefined/models/xrm/choice';
  export * from 'undefined/models/xrm/org-request/org-request';
  export * from 'undefined/models/value/date-time';
  export * from 'undefined/models/context/user';
  export * from 'undefined/models/context/context';

}
declare module 'undefined/global' {
  export * from 'undefined/global-auto';
  export * from "node_modules/guid-typescript/dist/guid/index";

}
declare module 'undefined/models/context/context' {
  export class Context {
  }

}
declare module 'undefined/models/context/user' {
  export class User {
  }

}
declare module 'undefined/models/value/date-time' {
  export class DateTime {
  }

}
declare module 'undefined/models/xrm/choice' {
  export class Choice {
  }

}
declare module 'undefined/models/xrm/entity' {
  import { Reference } from "undefined/models/xrm/reference";
  export class Entity extends Reference {
  }

}
declare module 'undefined/models/xrm/lookup' {
  import { Reference } from "undefined/models/xrm/reference";
  export class Lookup extends Reference {
      name: string;
  }

}
declare module 'undefined/models/xrm/org-request/org-request' {
  export class OrgRequest {
  }

}
declare module 'undefined/models/xrm/reference' {
  export class Reference {
      id: string;
      logicalName: string;
  }

}
declare module 'undefined/vm/broker' {
  export {};

}
declare module 'undefined/vm/helpers/string' {

}
declare module 'undefined/vm/memory' {
  export class Mem {
  }

}
declare module 'undefined/vm/runner' {
  export function run(expr: string, $this: any): void;

}
declare module 'undefined/vm/service' {
  export class Service {
  }

}
declare module 'undefined' {
  import main = require('undefined/index');
  export = main;
}