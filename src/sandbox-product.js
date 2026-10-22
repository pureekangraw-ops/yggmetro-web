import {isShopSandbox, shopOrigin} from './shop-origin.js';
export const sandboxProduct = Object.freeze({
 slug:'checkout-test',name:'ทดสอบสั่งซื้อ 40 บาท',label:'ไฟล์ตัวอย่างสำหรับทดสอบ',category:'business',kind:'Sandbox test',
 price:'฿40.00',status:'สินค้าทดสอบ',color:'#b6a4ff',code:'T1',headline:'ลองสั่งซื้อให้ครบทุกขั้นตอน',
 desc:'สินค้าตัวอย่างราคา 40 บาทสำหรับตรวจขั้นตอนสั่งซื้อ ยืนยันการชำระ และรับไฟล์ในระบบทดสอบ',
 audience:'เจ้าของระบบและผู้ตรวจรับ',features:['ราคาทดสอบ 40 บาท','รับไฟล์ตัวอย่างหลังระบบยืนยันการชำระจำลอง','ตรวจสิทธิ์ดาวน์โหลดของเจ้าของรายการ'],
 cta:'ตรวจหน้าชำระเงินทดสอบ',url:'/checkout',note:'ใช้ข้อมูลจำลองและไฟล์ตัวอย่างเท่านั้น โหมดทดสอบไม่เรียกเก็บเงินจริง',
 example:'เพิ่มลงตะกร้า → ชำระจำลองใน Stripe → กลับมาตรวจสถานะ → รับไฟล์ตัวอย่าง'
});
export function withSandboxProduct(products,env){
 return isShopSandbox(env)&&shopOrigin(env)?[...products,sandboxProduct]:products;
}
