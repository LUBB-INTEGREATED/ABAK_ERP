import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface RegisterFileInput {
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  ownerResource?: string;
  ownerResourceId?: string;
}

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  register(input: RegisterFileInput, uploadedById?: string) {
    return this.prisma.fileAsset.create({
      data: {
        url: input.url,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        ownerResource: input.ownerResource,
        ownerResourceId: input.ownerResourceId,
        uploadedById,
      },
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException();
    return asset;
  }

  listForOwner(ownerResource: string, ownerResourceId: string) {
    return this.prisma.fileAsset.findMany({
      where: { ownerResource, ownerResourceId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
