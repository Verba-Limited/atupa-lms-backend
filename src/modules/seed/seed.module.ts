import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { SeedService } from './seed.service';

@Module({
  imports: [CatalogModule],
  providers: [SeedService],
})
export class SeedModule {}
