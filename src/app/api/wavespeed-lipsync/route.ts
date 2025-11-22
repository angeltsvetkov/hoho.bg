import { NextRequest, NextResponse } from 'next/server';

interface WaveSpeedSubmitResponse {
    requestId: string;
    status?: string;
}

interface WaveSpeedResultResponse {
    status: string;
    output?: string;
    error?: string;
}

export async function POST(request: NextRequest) {
    try {
        const { audioUrl, imageUrl } = await request.json();

        if (!audioUrl || !imageUrl) {
            return NextResponse.json(
                { error: 'audioUrl and imageUrl are required' },
                { status: 400 }
            );
        }

        const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

        if (!WAVESPEED_API_KEY) {
            return NextResponse.json(
                { error: 'WaveSpeedAI API key not configured. Please add WAVESPEED_API_KEY to your .env.local file' },
                { status: 500 }
            );
        }

        // Step 1: Submit the task to WaveSpeedAI
        const submitResponse = await fetch(
            'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    audio: audioUrl,
                    image: imageUrl,
                    resolution: '480p', // Cost-effective option
                    seed: -1,
                }),
            }
        );

        if (!submitResponse.ok) {
            let errorDetails;
            try {
                errorDetails = await submitResponse.json();
                console.error('WaveSpeedAI submit error (JSON):', errorDetails);
            } catch {
                errorDetails = await submitResponse.text();
                console.error('WaveSpeedAI submit error (TEXT):', errorDetails);
            }

            return NextResponse.json(
                {
                    error: 'Failed to submit video generation task',
                    details: errorDetails,
                    status: submitResponse.status,
                    statusText: submitResponse.statusText
                },
                { status: submitResponse.status }
            );
        }

        const submitData: WaveSpeedSubmitResponse = await submitResponse.json();

        // WaveSpeedAI returns { data: { id: "..." } } not { requestId: "..." }
        const requestId = submitData.requestId || (submitData as any).data?.id;

        if (!requestId) {
            console.error('No requestId in response:', submitData);
            return NextResponse.json(
                { error: 'Invalid response from WaveSpeedAI - no request ID found' },
                { status: 500 }
            );
        }

        // Step 2: Poll for the result
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 0.1 second interval

            const resultResponse = await fetch(
                `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`,
                {
                    headers: {
                        'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
                    },
                }
            );

            const result = await resultResponse.json();

            if (resultResponse.ok) {
                const data = result.data;
                const status = data.status;

                if (status === 'completed') {
                    const resultUrl = data.outputs[0];

                    return NextResponse.json({
                        success: true,
                        videoUrl: resultUrl,
                        requestId,
                    });
                } else if (status === 'failed') {
                    console.error('Task failed:', data.error);
                    return NextResponse.json(
                        {
                            error: 'Video generation failed',
                            details: data.error || 'Unknown error'
                        },
                        { status: 500 }
                    );
                }
            } else {
                console.error('Error:', resultResponse.status, JSON.stringify(result));
                return NextResponse.json(
                    {
                        error: 'Failed to fetch result',
                        details: result
                    },
                    { status: resultResponse.status }
                );
            }
        }

    } catch (error) {
        console.error('Error in wavespeed-lipsync API:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: String(error) },
            { status: 500 }
        );
    }
}
