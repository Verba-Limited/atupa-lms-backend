import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog';
import { LibraryModule } from '../library';
import { SearchService } from './application/search.service';
import { SearchController } from './presentation/http/search.controller';

@Module({
  imports: [CatalogModule, LibraryModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
