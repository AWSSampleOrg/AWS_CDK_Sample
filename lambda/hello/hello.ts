export const handler = async (event: {
    message: string;
}): Promise<{
    statusCode: number;
    body: string;
}> => {
    console.log(JSON.stringify(event, null, 2));
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: "Hello World",
        }),
    };
};
