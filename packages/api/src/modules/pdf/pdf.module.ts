import { Module } from '@nestjs/common';
import { QuotesModule } from '../quotes/quotes.module';
import { PdfRenderService } from './pdf-render.service';
import { QuotePdfController } from './quote-pdf.controller';
import { QuotePdfService } from './quote-pdf.service';

@Module({
  imports: [QuotesModule],
  controllers: [QuotePdfController],
  providers: [PdfRenderService, QuotePdfService],
  exports: [PdfRenderService],
})
export class PdfModule {}
