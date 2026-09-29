import {
HeartPulse,
ArrowRight
} from "lucide-react";


export default function RiskOverview(){


return(

<div
className="
bg-white
rounded-3xl
p-8
grid
grid-cols-3
gap-6
"
>


<div
className="
col-span-2
"
>


<p
className="
text-gray-500
"
>

Tingkat Risiko Saat Ini

</p>


<h2
className="
text-5xl
font-semibold
mt-3
text-orange-500
"
>

Sedang

</h2>


<p
className="
mt-4
text-gray-600
"
>

Berdasarkan pemeriksaan terakhir
20 September 2026

</p>


<button
className="
mt-6
flex
items-center
gap-2
bg-[#063c38]
text-white
px-5
py-3
rounded-xl
"
>

Lihat Detail

<ArrowRight size={18}/>

</button>


</div>





<div
className="
bg-[#edf6f3]
rounded-2xl
p-6
flex
flex-col
justify-center
"
>


<HeartPulse
size={40}
/>


<p
className="
mt-4
font-medium
"
>

Langkah sehat hari ini

</p>


<p
className="
text-gray-600
text-sm
mt-2
"
>

Mencegah komplikasi
esok hari

</p>



</div>


</div>


)

}