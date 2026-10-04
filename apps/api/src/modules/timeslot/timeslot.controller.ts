import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { TimeSlotQueryDto } from './dto/timeslot-query.dto';
import { TimeSlotService } from './timeslot.service';

@Controller('time-slots')
export class TimeSlotController {
  constructor(private readonly timeSlotService: TimeSlotService) {}

  /** 查询指定日期可预约时段与余量 */
  @Public()
  @Get()
  getSlots(@Query() query: TimeSlotQueryDto) {
    return this.timeSlotService.getSlots(query);
  }
}
