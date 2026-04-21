import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  POStatus,
  PaymentValidationStatus,
  Prisma,
  ProjectStatus,
} from '@prisma/client';
import { nextEntityNumber } from 'shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateInvoiceDto,
  ListInvoicesDto,
  ListPaymentsDto,
  RecordPaymentDto,
  ValidateCommercialConfirmationDto,
  ValidatePaymentDto,
} from './dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Commercial confirmations ─────────────────────────────────

  listCommercialConfirmations(status?: PaymentValidationStatus) {
    return this.prisma.commercialConfirmation.findMany({
      where: status ? { validationStatus: status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        quote: {
          select: {
            id: true,
            quoteNumber: true,
            title: true,
            totalAmount: true,
            client: {
              select: { id: true, contactName: true, companyName: true },
            },
          },
        },
      },
    });
  }

  async validateCommercialConfirmation(
    id: string,
    dto: ValidateCommercialConfirmationDto,
    actorId: string,
  ) {
    const confirmation = await this.prisma.commercialConfirmation.findUnique({
      where: { id },
      include: {
        quote: { select: { id: true, clientId: true, totalAmount: true } },
      },
    });
    if (!confirmation) throw new NotFoundException();
    if (confirmation.validationStatus !== PaymentValidationStatus.PENDING) {
      throw new BadRequestException(
        'This commercial confirmation is already decided',
      );
    }

    if (dto.status === PaymentValidationStatus.REJECTED) {
      return this.prisma.commercialConfirmation.update({
        where: { id },
        data: {
          validationStatus: dto.status,
          validatedAt: new Date(),
          validatedById: actorId,
          validationNote: dto.note,
        },
      });
    }

    // BR-12: on validation, mint the PO, bump client LTV, leave the door
    // open for project creation.
    const poNumber = await this.generatePoNumber();
    await this.prisma.$transaction(async (tx) => {
      await tx.commercialConfirmation.update({
        where: { id },
        data: {
          validationStatus: dto.status,
          validatedAt: new Date(),
          validatedById: actorId,
          validationNote: dto.note,
        },
      });
      await tx.purchaseOrder.create({
        data: {
          poNumber,
          quoteId: confirmation.quoteId,
          clientId: confirmation.quote.clientId,
          contractValue: confirmation.contractValue,
          status: POStatus.ACTIVE,
        },
      });
      await tx.client.update({
        where: { id: confirmation.quote.clientId },
        data: { lifetimeValue: { increment: confirmation.contractValue } },
      });
    });

    return this.prisma.commercialConfirmation.findUnique({
      where: { id },
    });
  }

  // ─── Invoices ─────────────────────────────────────────────────

  list(query: ListInvoicesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.InvoiceWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
    };

    return this.prisma
      .$transaction([
        this.prisma.invoice.count({ where }),
        this.prisma.invoice.findMany({
          where,
          orderBy: { issueDate: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            client: {
              select: { id: true, contactName: true, companyName: true },
            },
            po: { select: { id: true, poNumber: true } },
            _count: { select: { payments: true } },
          },
        }),
      ])
      .then(([total, data]) => ({
        data,
        pagination: {
          total,
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize),
        },
      }));
  }

  async createInvoice(dto: CreateInvoiceDto, actorId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: dto.poId },
    });
    if (!po) throw new NotFoundException('Purchase order not found');

    const totalAmount = dto.subtotal + dto.taxAmount;
    const number = await this.generateInvoiceNumber();

    return this.prisma.invoice.create({
      data: {
        invoiceNumber: number,
        poId: po.id,
        clientId: po.clientId,
        projectId: dto.projectId,
        milestoneId: dto.milestoneId,
        dueDate: new Date(dto.dueDate),
        subtotal: dto.subtotal,
        taxAmount: dto.taxAmount,
        totalAmount,
        status: InvoiceStatus.ISSUED,
        createdBy: actorId,
      },
    });
  }

  // ─── Payments ─────────────────────────────────────────────────

  listPayments(query: ListPaymentsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.PaymentWhereInput = {
      ...(query.validationStatus
        ? { validationStatus: query.validationStatus }
        : {}),
      ...(query.poId ? { poId: query.poId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
    };

    return this.prisma
      .$transaction([
        this.prisma.payment.count({ where }),
        this.prisma.payment.findMany({
          where,
          orderBy: { receivedAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            client: {
              select: { id: true, contactName: true, companyName: true },
            },
            invoice: {
              select: { id: true, invoiceNumber: true, totalAmount: true },
            },
            po: { select: { id: true, poNumber: true, contractValue: true } },
          },
        }),
      ])
      .then(([total, data]) => ({
        data,
        pagination: {
          total,
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize),
        },
      }));
  }

  async recordPayment(dto: RecordPaymentDto, actorId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: dto.poId },
    });
    if (!po) throw new NotFoundException('Purchase order not found');

    if (dto.invoiceId) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: dto.invoiceId },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.poId !== dto.poId) {
        throw new BadRequestException('Invoice does not belong to this PO');
      }
    }

    const number = await this.generatePaymentNumber();
    return this.prisma.payment.create({
      data: {
        paymentNumber: number,
        poId: po.id,
        clientId: po.clientId,
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        method: dto.method,
        receivedAt: new Date(dto.receivedAt),
        referenceNumber: dto.referenceNumber,
        docUrl: dto.docUrl,
        createdBy: actorId,
      },
      include: {
        po: true,
        invoice: true,
      },
    });
  }

  // BR-17: payment validation is where money officially "lands". We update
  // the invoice status, bump the PO toward COMPLETED when the contract
  // value is covered, and auto-flip project.closureChecklist.finalPaymentReceived
  // when the cumulative validated payments cover the project's contract value.
  async validatePayment(id: string, dto: ValidatePaymentDto, actorId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        po: {
          include: {
            project: { include: { closureChecklist: true } },
          },
        },
        invoice: true,
      },
    });
    if (!payment) throw new NotFoundException();
    if (payment.validationStatus !== PaymentValidationStatus.PENDING) {
      throw new BadRequestException('Payment already validated');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: {
          validationStatus: dto.status,
          validatedAt: new Date(),
          validatedById: actorId,
          validationNote: dto.note,
        },
      });

      if (dto.status !== PaymentValidationStatus.VALIDATED) return updated;

      // Invoice progression
      if (payment.invoiceId) {
        const invoicePayments = await tx.payment.findMany({
          where: {
            invoiceId: payment.invoiceId,
            validationStatus: PaymentValidationStatus.VALIDATED,
          },
          select: { amount: true },
        });
        const totalPaid = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
        const invoice = payment.invoice;
        if (invoice) {
          let newStatus: InvoiceStatus = InvoiceStatus.ISSUED;
          if (totalPaid >= invoice.totalAmount - 0.01) {
            newStatus = InvoiceStatus.PAID;
          } else if (totalPaid > 0) {
            newStatus = InvoiceStatus.PARTIALLY_PAID;
          }
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: newStatus },
          });
        }
      }

      // PO progression — when cumulative validated payments cover the
      // contract value, mark the PO COMPLETED.
      const poPayments = await tx.payment.findMany({
        where: {
          poId: payment.poId,
          validationStatus: PaymentValidationStatus.VALIDATED,
        },
        select: { amount: true },
      });
      const totalCollected = poPayments.reduce((s, p) => s + p.amount, 0);
      if (totalCollected >= payment.po.contractValue - 0.01) {
        await tx.purchaseOrder.update({
          where: { id: payment.poId },
          data: { status: POStatus.COMPLETED },
        });
      }

      // Project closure gate auto-flip.
      const project = payment.po.project;
      if (
        project &&
        project.closureChecklist &&
        totalCollected >= project.contractValue - 0.01 &&
        !project.closureChecklist.finalPaymentReceived
      ) {
        await tx.closureChecklist.update({
          where: { projectId: project.id },
          data: {
            finalPaymentReceived: true,
            finalPaymentReceivedAt: new Date(),
            finalPaymentReceivedById: actorId,
          },
        });
      }

      // Financial-risk flag — if this payment moves collected value above
      // execution value, clear the flag; if still below, (re)set it.
      if (project) {
        const progressValue =
          ((project.actualProgress ?? 0) / 100) * project.contractValue;
        const shouldFlag = progressValue > totalCollected + 0.01;
        if (shouldFlag !== project.financialRiskFlagged) {
          await tx.project.update({
            where: { id: project.id },
            data: {
              financialRiskFlagged: shouldFlag,
              financialRiskFlaggedAt: shouldFlag ? new Date() : null,
              financialRiskReason: shouldFlag
                ? 'Execution progress exceeds collected payments'
                : null,
              status:
                shouldFlag && project.status === ProjectStatus.ACTIVE
                  ? ProjectStatus.AT_RISK
                  : !shouldFlag && project.status === ProjectStatus.AT_RISK
                    ? ProjectStatus.ACTIVE
                    : project.status,
            },
          });
        }
      }

      return updated;
    });
  }

  // ─── Stats ────────────────────────────────────────────────────

  async stats() {
    const [
      pendingConfirmations,
      pendingPayments,
      overdueInvoices,
      totalCollectedValidated,
    ] = await this.prisma.$transaction([
      this.prisma.commercialConfirmation.count({
        where: { validationStatus: PaymentValidationStatus.PENDING },
      }),
      this.prisma.payment.count({
        where: { validationStatus: PaymentValidationStatus.PENDING },
      }),
      this.prisma.invoice.count({
        where: {
          status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
          dueDate: { lt: new Date() },
        },
      }),
      this.prisma.payment.aggregate({
        where: { validationStatus: PaymentValidationStatus.VALIDATED },
        _sum: { amount: true },
      }),
    ]);

    return {
      pendingConfirmations,
      pendingPayments,
      overdueInvoices,
      totalCollected: totalCollectedValidated._sum.amount ?? 0,
    };
  }

  // ─── Number generators ────────────────────────────────────────

  private async generateInvoiceNumber() {
    const last = await this.prisma.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });
    return nextEntityNumber('INV', last?.invoiceNumber);
  }

  private async generatePaymentNumber() {
    const last = await this.prisma.payment.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { paymentNumber: true },
    });
    return nextEntityNumber('PAY', last?.paymentNumber);
  }

  private async generatePoNumber() {
    const last = await this.prisma.purchaseOrder.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { poNumber: true },
    });
    return nextEntityNumber('PO', last?.poNumber);
  }
}
