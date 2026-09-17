import {prisma} from "@/lib/prisma";
import {catalogProductSelect} from "@/lib/catalog-product-select";
import {serializeProduct} from "@/lib/serialize";
import {pickReviewStat,reviewStatsForProductIds} from "@/lib/review-stats";
export async function bestSellers(offset=0,limit=6){
 const take=Math.min(48,Math.max(1,Number.isFinite(limit)?Math.floor(limit):6));
 const skip=Math.max(0,Number.isFinite(offset)?Math.floor(offset):0);
 const where={isBestSeller:true,isActive:true};
 const [total,rows]=await Promise.all([prisma.product.count({where}),prisma.product.findMany({where,select:catalogProductSelect({take:1}),orderBy:{updatedAt:"desc"},skip,take})]);
 const stats=await reviewStatsForProductIds(rows.map(p=>p.id));
 return {products:rows.map(p=>({...serializeProduct(p,{forAdmin:false}),...pickReviewStat(stats,p.id)})),total,offset:skip,limit:take};
}
