const steps = [
  "Lengkapi Data Klinis",
  "Ambil Foto Kaki",
  "Analisis AI",
  "Lihat Hasil",
];

export default function ExaminationTimeline() {
  return (
    <div
      className="
bg-white
rounded-3xl
p-8
"
    >
      <h2
        className="
text-xl
font-semibold
mb-8
"
      >
        Alur Pemeriksaan
      </h2>

      <div
        className="
space-y-8
"
      >
        {steps.map((step, index) => (
          <div
            key={step}
            className="
flex
gap-5
items-start
"
          >
            <div
              className="
w-10
h-10
rounded-full
bg-[#063c38]
text-white
flex
items-center
justify-center
"
            >
              {index + 1}
            </div>

            <div>
              <h3
                className="
font-medium
"
              >
                {step}
              </h3>

              <p
                className="
text-sm
text-gray-500
mt-1
"
              >
                Tahapan pemeriksaan FootGuard
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
