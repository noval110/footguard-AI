import {
Users,
AlertCircle,
CheckCircle
} from "lucide-react";


const stats=[
{
title:"Pasien Aktif",
value:"124",
icon:Users
},
{
title:"Risiko Tinggi",
value:"8",
icon:AlertCircle
},
{
title:"Selesai Review",
value:"42",
icon:CheckCircle
}
];


export default function ProviderSummary(){


return(

<div
className="
grid
grid-cols-3
gap-5
"
>


{
stats.map(item=>{


const Icon=item.icon;


return(

<div
key={item.title}
className="
bg-white
rounded-3xl
p-6
"
>


<Icon
className="
text-[#063c38]
"
/>


<p
className="
text-gray-500
mt-5
"
>

{item.title}

</p>


<h2
className="
text-4xl
font-semibold
mt-2
"
>

{item.value}

</h2>


</div>

)


})

}


</div>

)

}