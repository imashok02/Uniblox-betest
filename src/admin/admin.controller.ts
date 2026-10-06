import { Controller, Post, Get } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('coupons/generate')
  async generateCoupon() {
    return this.adminService.generateCoupon();
  }

  @Get('report')
  async getReport() {
    return this.adminService.getReport();
  }
}
