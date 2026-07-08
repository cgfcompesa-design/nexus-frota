import { Car } from "lucide-react";

interface Item {

    placa: string;

    km: number;

}

interface Props {

    dados: Item[];

}

export default function TopKm({

    dados

}: Props) {

    const maiorKm = Math.max(

        ...dados.map(item => item.km),

        1

    );

    return (

        <div className="bg-white rounded-xl border shadow-sm">

            <div className="flex items-center gap-2 p-5 border-b">

                <Car className="text-blue-600" />

                <h2 className="text-lg font-semibold">

                    Top 10 Veículos por KM

                </h2>

            </div>

            <div className="p-5 space-y-4">

                {

                    dados.map((item, index) => {

                        const percentual =
                            (item.km / maiorKm) * 100;

                        return (

                            <div
                                key={item.placa}
                            >

                                <div className="flex justify-between mb-1">

                                    <div className="flex gap-3">

                                        <span className="font-semibold text-gray-500">

                                            #{index + 1}

                                        </span>

                                        <span>

                                            {item.placa}

                                        </span>

                                    </div>

                                    <span className="font-semibold">

                                        {item.km.toLocaleString("pt-BR")} km

                                    </span>

                                </div>

                                <div className="h-3 rounded-full bg-gray-200">

                                    <div

                                        className="h-3 rounded-full bg-blue-600 transition-all duration-500"

                                        style={{

                                            width: `${percentual}%`

                                        }}

                                    />

                                </div>

                            </div>

                        );

                    })

                }

            </div>

        </div>

    );

}
