import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SorobanService } from './soroban.service';

@Module({
  imports: [ConfigModule],
  providers: [SorobanService],
  exports: [SorobanService],
})
export class StellarModule {}
