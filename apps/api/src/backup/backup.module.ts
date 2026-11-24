import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller.ts';
import { BackupService } from './backup.service.ts';

@Module({ controllers: [BackupController], providers: [BackupService], exports: [BackupService] })
export class BackupModule {}
