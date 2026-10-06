import { Controller, Post, Get, Put, Body } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('coupons/generate')
  async generateCoupon() {
    return this.adminService.generateCoupon();
  }

  @Get('coupons')
  async getCoupons() {
    return this.adminService.getCoupons();
  }

  @Get('config')
  async getConfig() {
    return this.adminService.getConfigValues();
  }

  @Put('config')
  async updateConfig(@Body() body: { frequency: number; discountPercent: number }) {
    return this.adminService.updateConfig(body.frequency, body.discountPercent);
  }

  @Get('report')
  async getReport() {
    return this.adminService.getReport();
  }
}
