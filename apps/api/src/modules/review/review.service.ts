import { Injectable, Logger } from '@nestjs/common';
import type { Review } from '@prisma/client';
import { ErrorCode, OrderStatus } from '@hc/shared';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { toSharedStatus } from '../order/order-status.util';
import { CreateReviewDto, ReviewQueryDto } from './dto/review.dto';

function toReviewVo(review: Review, staffName?: string) {
  return {
    id: review.id.toString(),
    orderId: review.orderId.toString(),
    score: review.score,
    tags: (review.tags as string[] | null) ?? [],
    content: review.content,
    images: (review.images as string[] | null) ?? [],
    isAnonymous: review.isAnonymous,
    reply: review.reply,
    staffName: review.isAnonymous ? '匿名用户' : staffName ?? null,
    createdAt: review.createdAt,
  };
}

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 提交评价：一单一评，且只有已完成的订单可以评价
  async create(userId: bigint, dto: CreateReviewDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(dto.orderId), userId, deletedAt: null },
    });

    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND);
    }

    if (toSharedStatus(order.status) !== OrderStatus.COMPLETED) {
      throw new BizException(ErrorCode.ORDER_STATE_INVALID, '只有已完成的订单可以评价');
    }

    if (!order.staffId) {
      throw new BizException(ErrorCode.ORDER_STATE_INVALID, '该订单没有服务人员，无法评价');
    }

    const exists = await this.prisma.review.findUnique({ where: { orderId: order.id } });
    if (exists) {
      throw new BizException(ErrorCode.CONFLICT_RETRY, '该订单已经评价过了');
    }

    const review = await this.prisma.review.create({
      data: {
        orderId: order.id,
        userId,
        staffId: order.staffId,
        score: dto.score,
        tags: (dto.tags ?? []) as never,
        content: dto.content ?? null,
        images: (dto.images ?? []) as never,
        isAnonymous: dto.isAnonymous ?? false,
      },
    });

    await this.refreshStaffRating(order.staffId);

    // 评价也写入状态流水，便于后台按时间线查看
    await this.prisma.orderStatusLog.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        operatorType: 'USER',
        operatorId: userId.toString(),
        reason: `提交评价：${dto.score} 星`,
      },
    });

    const staff = await this.prisma.staff.findUnique({ where: { id: order.staffId } });

    return toReviewVo(review, staff?.name);
  }

  // 重新计算保洁师平均分（评分对外展示为一位小数）
  private async refreshStaffRating(staffId: bigint) {
    const agg = await this.prisma.review.aggregate({
      _avg: { score: true },
      where: { staffId, deletedAt: null },
    });

    const average = agg._avg.score ?? 5;

    await this.prisma.staff.update({
      where: { id: staffId },
      data: { ratingX10: Math.round(average * 10) },
    });

    this.logger.log(`保洁师 ${staffId} 评分更新为 ${average.toFixed(1)}`);
  }

  async listMine(userId: bigint, query: ReviewQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const [total, list] = await this.prisma.$transaction([
      this.prisma.review.count({ where: { userId, deletedAt: null } }),
      this.prisma.review.findMany({
        where: { userId, deletedAt: null },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { staff: true },
      }),
    ]);

    return {
      list: list.map((review) => toReviewVo(review, review.staff?.name)),
      total,
      page,
      pageSize,
    };
  }

  async listByStaff(staffId: bigint, query: ReviewQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const [total, list, agg] = await this.prisma.$transaction([
      this.prisma.review.count({ where: { staffId, deletedAt: null } }),
      this.prisma.review.findMany({
        where: { staffId, deletedAt: null },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.review.aggregate({ _avg: { score: true }, where: { staffId, deletedAt: null } }),
    ]);

    return {
      list: list.map((review) => toReviewVo(review)),
      total,
      page,
      pageSize,
      averageScore: Number((agg._avg.score ?? 0).toFixed(1)),
    };
  }

  // 订单详情内展示评价
  async getByOrder(orderId: bigint) {
    const review = await this.prisma.review.findFirst({
      where: { orderId, deletedAt: null },
      include: { staff: true },
    });

    return review ? toReviewVo(review, review.staff?.name) : null;
  }
}
