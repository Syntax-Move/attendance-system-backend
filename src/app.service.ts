import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return `Hello World! from ${process.env.NODE_ENV} environment  update 02`;
  }
}
