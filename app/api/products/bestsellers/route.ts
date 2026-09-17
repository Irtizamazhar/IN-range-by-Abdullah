import {NextRequest,NextResponse} from "next/server";
import {bestSellers} from "@/lib/best-sellers";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 try{return NextResponse.json(await bestSellers(Number(request.nextUrl.searchParams.get("offset")||0),Number(request.nextUrl.searchParams.get("limit")||6)));}
 catch {return NextResponse.json({error:"Products are temporarily unavailable."},{status:503});}
}
