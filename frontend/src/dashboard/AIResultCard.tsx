import { ShieldCheck, AlertTriangle, Activity } from "lucide-react";

export default function AIResultCard() {
  return (
    <div
      className="
bg-white
rounded-3xl
p-8
shadow-sm
"
    >
      {/* Header */}

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
text-sm
text-gray-500
"
          >
            Hasil Analisis AI
          </p>

          <h2
            className="
text-2xl
font-semibold
"
          >
            Pemeriksaan Kaki
          </h2>
        </div>

        <div
          className="
bg-green-100
text-green-700
px-4
py-2
rounded-full
flex
gap-2
items-center
"
        >
          <ShieldCheck size={18} />
          87% Confidence
        </div>
      </div>

      <div
        className="
grid
grid-cols-2
gap-8
"
      >
        {/* Image */}

        <div
          className="
relative
rounded-2xl
overflow-hidden
h-[280px]
"
        >
          <img
            src="/src/assets/editorial-feet.png"
            className="
w-full
h-full
object-cover
"
          />

          {/* Heatmap */}

          <div
            className="
absolute
bottom-20
left-1/2
-translate-x-1/2

w-28
h-28

rounded-full

bg-red-500/50

blur-xl

"
          />

          <div
            className="
absolute
bottom-24
left-1/2
-translate-x-1/2

w-14
h-14

rounded-full

bg-orange-400/70

rounded-full

"
          />
        </div>

        {/* Detail */}

        <div
          className="
space-y-5
"
        >
          <div>
            <p
              className="
text-gray-500
text-sm
"
            >
              Temuan Visual
            </p>

            <h3
              className="
text-xl
font-semibold
mt-2
"
            >
              Area tekanan tinggi terdeteksi
            </h3>
          </div>

          <div
            className="
flex
items-center
gap-3
bg-orange-50
p-4
rounded-xl
"
          >
            <AlertTriangle className="text-orange-500" />

            <div>
              <p className="font-medium">Risiko Sedang</p>

              <p
                className="
text-sm
text-gray-600
"
              >
                Perlu pemeriksaan lanjutan
              </p>
            </div>
          </div>

          <div>
            <div
              className="
flex
justify-between
mb-2
"
            >
              <span>Tingkat Keyakinan Model</span>

              <span>87%</span>
            </div>

            <div
              className="
h-3
bg-gray-200
rounded-full
overflow-hidden
"
            >
              <div
                className="
h-full
bg-[#063c38]
w-[87%]
"
              />
            </div>
          </div>

          <div
            className="
bg-[#f5f8f7]
rounded-xl
p-4
"
          >
            <div
              className="
flex
gap-3
items-center
mb-2
"
            >
              <Activity size={18} />

              <p
                className="
font-medium
"
              >
                Rekomendasi
              </p>
            </div>

            <ul
              className="
text-sm
space-y-2
text-gray-600
"
            >
              <li>✓ Konsultasi dengan tenaga medis</li>

              <li>✓ Pantau kondisi kaki secara berkala</li>

              <li>✓ Lakukan pemeriksaan ulang</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
