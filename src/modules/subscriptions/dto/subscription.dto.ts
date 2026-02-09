import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class ValidateReceiptDto {
  @IsString()
  @IsNotEmpty()
  receiptData: string;

  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @IsOptional()
  @IsString()
  productId?: string;
}
