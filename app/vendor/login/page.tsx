import {redirect} from "next/navigation";
import VendorLoginAppeal from "@/components/vendor/VendorLoginAppeal";
export default function Page({searchParams}:{searchParams:{appeal?:string}}){
 if(searchParams.appeal==="1")return <VendorLoginAppeal/>;
 redirect("/login?role=vendor&mode=signin");
}