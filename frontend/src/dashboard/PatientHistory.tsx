import {
  CalendarDays,
  ChevronRight
} from "lucide-react";


const history = [
  {
    date:"20 Sep 2026",
    type:"AI Foot Scan",
    result:"Risiko Sedang",
    status:"Review"
  },
  {
    date:"12 Agu 2026",
    type:"Pemeriksaan Manual",
    result:"Normal",
    status:"Selesai"
  },
  {
    date:"05 Jul 2026",
    type:"AI Foot Scan",
    result:"Risiko Rendah",
    status:"Selesai"
  }
];


export default function PatientHistory(){

return(

<div
className="
bg-white
rounded-3xl
p-8
"
>


<div
className="
flex
justify-between
items-center
mb-6
"
>

<div>

<p
className="
text-gray-500
text-sm
"
>
Riwayat Pemeriksaan
</p>


<h2
className="
text-2xl
font-semibold
"
>
Aktivitas Terbaru
</h2>

</div>


<button
className="
flex
items-center
gap-2
text-[#063c38]
"
>

Lihat Semua

<ChevronRight size={18}/>

</button>


</div>




<div
className="
space-y-4
"
>


{
history.map((item)=>(


<div
key={item.date}
className="
grid
grid-cols-4
items-center
p-5
rounded-2xl
bg-[#f7f9f8]
"
>


<div
className="
flex
items-center
gap-3
"
>

<CalendarDays
size={20}
/>

<span>
{item.date}
</span>


</div>


<div>
{item.type}
</div>


<div
className="
font-medium
"
>

{item.result}

</div>


<div>

<span
className="
px-4
py-2
rounded-full
bg-white
text-sm
"
>

{item.status}

</span>


</div>


</div>


))

}


</div>


</div>


)

}