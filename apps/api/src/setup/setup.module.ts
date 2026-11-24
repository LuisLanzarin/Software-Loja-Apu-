import { Module } from '@nestjs/common';
import { SetupController } from './setup.controller.ts';

@Module({ controllers: [SetupController] })
export class SetupModule {}
