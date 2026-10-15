import { Module } from '@nestjs/common';
import { CatalogModule } from '../modules/catalog';
import { GamecardModule } from '../modules/gamecard';
import { LibraryModule } from '../modules/library';
import { SeedService } from './seed.service';

@Module({
  imports: [CatalogModule, LibraryModule, GamecardModule],
  providers: [SeedService],
})
export class SeedModule {}
